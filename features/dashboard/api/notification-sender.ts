import "server-only"
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { notification, notify } from "@/lib/in-app-notifications"
import { koblipTemplatesSent, usageMonth } from "@/lib/koblip-usage"
import {
  bookings,
  businesses,
  chatConnections,
  chatReplies,
  koblipChatConnection,
  notificationSends,
} from "@/lib/db/schema"
import type { NotificationRules } from "@/lib/notification-rules"
import { notificationRules } from "@/lib/platform-settings"
import {
  BOOKING_MESSAGES,
  bookingValues,
  exampleValues,
  isOwnerAlert,
  plainMessage,
  thankYouMessage,
  withValues,
  type BookingField,
  type BookingMessage,
  type TemplateLanguage,
} from "../utils/booking-templates"
import type { SendKind, Sender } from "../types/notifications"
import { localDateTime, planReminders } from "../utils/reminder-schedule"
import { ChatApiError, chatApi, chatConnectionUsable, koblipChatApi } from "./chat-oauth"
import {
  koblipSendableTemplate,
  ownTemplatesApproved,
  refreshChatTemplates,
  sendableTemplate,
} from "./chat-templates"
import { notificationSettingsFor } from "./notifications"

// Book's WhatsApp booking messages (docs/koblip-chat-integration.md, step 3),
// sent through Koblip Chat with its public API: the person as a contact
// (POST /api/contacts/find-or-create), then the message
// (POST /api/whatsapp/send). Plain text inside Meta's 24-hour window, the
// approved template outside it.
//
// Each message goes from one number (K3): the business's own once it is
// connected and Meta approved its messages, else Koblip's, with Koblip's
// ready-made templates; the row records which.
//
// Every message is a row in notification_sends, made once per booking,
// message and reminder time (a unique index), so it can never go twice:
// a row is claimed (pending → sending) before the send, and Chat's send has
// no idempotency key, so a failed send is never tried again.

const MINUTE = 60_000

type Send = typeof notificationSends.$inferInsert

// The connections Book may send through: working, allowed to use templates,
// and with a WhatsApp number.
async function sendingConnections() {
  const rows = await db
    .select()
    .from(chatConnections)
    .where(and(eq(chatConnections.needsReconnect, false), isNotNull(chatConnections.phoneNumberId)))
  return rows.filter(chatConnectionUsable)
}

// Koblip's own connection (K1) when it can send: working, allowed to use
// templates, and with a WhatsApp number.
async function koblipConnection() {
  const [row] = await db.select().from(koblipChatConnection).limit(1)
  return row && chatConnectionUsable(row) && row.phoneNumberId ? row : null
}

type ApiInit = Parameters<typeof chatApi>[2]

// The number one business's messages go from, and how to reach Chat for it.
type Line = {
  sender: Sender
  workspaceId: string
  phoneNumberId: string
  call: <T>(path: string, init?: ApiInit) => Promise<T>
}

// Koblip's number is for businesses with an owner who can see and control
// what goes in their name; never for a demo.
async function koblipMayServe(businessId: string) {
  const [row] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), isNotNull(businesses.ownerId), eq(businesses.isDemo, false)))
    .limit(1)
  return !!row
}

// Who one message goes to, when it is known: the person's 24-hour window
// with the business's own number lets that number send a normal message.
type WindowCheck = {
  digits: string
  // A normal message may go inside the window (the 24-hour setting, or a
  // message that is only ever a normal one, like the thank-you).
  useWindow: boolean
  now: Date
  rules: NotificationRules
}

// Which number a business sends from now: its own when connected and Meta
// approved every message it has on, in each language, or when the person's
// 24-hour window with it is open and a normal message may go (D35); else
// Koblip's; else its own as it stands (normal messages in the window,
// approved templates). "wait" when a connection must be renewed first; null
// when none can send. Without a recipient (the page), only approval counts.
async function lineFor(
  businessId: string,
  turnedOff: BookingMessage[],
  recipient?: WindowCheck
): Promise<Line | "wait" | null> {
  const [[own], koblip] = await Promise.all([
    db.select().from(chatConnections).where(eq(chatConnections.businessId, businessId)).limit(1),
    db
      .select()
      .from(koblipChatConnection)
      .limit(1)
      .then(async ([row]) => (row && (await koblipMayServe(businessId)) ? row : null)),
  ])
  const ownLine: Line | null =
    own && chatConnectionUsable(own) && own.phoneNumberId
      ? {
          sender: "own",
          workspaceId: own.workspaceId,
          phoneNumberId: own.phoneNumberId,
          call: (path, init) => chatApi(businessId, path, init),
        }
      : null
  const on = BOOKING_MESSAGES.filter((message) => !turnedOff.includes(message))
  if (ownLine && (await ownTemplatesApproved(businessId, on))) return ownLine
  if (
    ownLine &&
    recipient?.useWindow &&
    (await windowOpen(
      ownLine.workspaceId,
      ownLine.phoneNumberId,
      recipient.digits,
      recipient.now,
      recipient.rules
    ))
  ) {
    return ownLine
  }
  if (koblip && chatConnectionUsable(koblip) && koblip.phoneNumberId) {
    return {
      sender: "koblip",
      workspaceId: koblip.workspaceId,
      phoneNumberId: koblip.phoneNumberId,
      call: (path, init) => koblipChatApi(path, init),
    }
  }
  if (ownLine) return ownLine
  return own || koblip ? "wait" : null
}

// Which number the business's messages go from now (the WhatsApp page
// shows it, K4): null when none can send, or a connection must be renewed.
export async function senderFor(businessId: string): Promise<Sender | null> {
  const settings = await notificationSettingsFor(businessId)
  const line = await lineFor(businessId, settings.turnedOff)
  return line && line !== "wait" ? line.sender : null
}

// The businesses Book plans messages for, each with the moment it could
// first send: bookings made before then get none.
async function sendingBusinesses() {
  const since = new Map<string, string>()
  for (const connection of await sendingConnections()) {
    since.set(connection.businessId, connection.createdAt)
  }
  const koblip = await koblipConnection()
  if (koblip) {
    const served = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(isNotNull(businesses.ownerId), eq(businesses.isDemo, false)))
    for (const { id } of served) {
      const own = since.get(id)
      if (!own || koblip.createdAt < own) since.set(id, koblip.createdAt)
    }
  }
  return since
}

// The messages that go to the customer and can fail unseen: the owner hears
// of each failure (S5). The thank-you is a courtesy, never worth an alert.
const ALERT_ON_FAILURE = BOOKING_MESSAGES.filter((message) => !isOwnerAlert(message))

// What still goes once the booking is cancelled: the cancellation note, the
// owner's alert that the customer cancelled, and the thank-you for the tap.
const AFTER_CANCEL: readonly SendKind[] = ["cancelled", "ownerCancelled", "thankYou"]

// Every kind the sender sends: the booking messages, the owner's alerts and
// the thank-you.
const SEND_KINDS: readonly SendKind[] = [...BOOKING_MESSAGES, "thankYou"]

// New rows for bookings made since the business could send: the confirmation,
// the owner's alert and the reminders; "Booking changed" and new reminders
// for bookings moved; the cancellation note for bookings cancelled after
// their confirmation went; and the owner's alert for a message that failed.
async function plan(now: Date) {
  const confirmed = alias(notificationSends, "confirmed")
  const cancelled = alias(notificationSends, "cancelled")
  const changed = alias(notificationSends, "changed")
  const alerted = alias(notificationSends, "alerted")

  for (const [businessId, since] of await sendingBusinesses()) {
    const [settings, [business]] = await Promise.all([
      notificationSettingsFor(businessId),
      db.select({ timezone: businesses.timezone }).from(businesses).where(eq(businesses.id, businessId)),
    ])
    if (!business) continue

    const fresh = await db
      .select({ booking: bookings })
      .from(bookings)
      .leftJoin(
        confirmed,
        and(eq(confirmed.bookingId, bookings.id), eq(confirmed.message, "confirmed"))
      )
      .where(
        and(
          eq(bookings.businessId, businessId),
          ne(bookings.status, "cancelled"),
          gt(bookings.startAt, now.toISOString()),
          gte(bookings.createdAt, since),
          isNull(confirmed.id)
        )
      )

    const rows: Send[] = fresh.flatMap(({ booking }) => {
      const base = {
        businessId,
        bookingId: booking.id,
        moves: booking.moves,
        dueAt: now.toISOString(),
      }
      const reachable = booking.whatsappOptIn && booking.customerPhone
      const out: Send[] = [
        {
          ...base,
          message: "confirmed",
          state: reachable ? "pending" : "skipped",
          reason: reachable ? null : booking.customerPhone ? "noOptIn" : "noPhone",
        },
      ]
      // The owner hears of bookings customers make, not of their own.
      if (booking.source === "online") {
        out.push({
          ...base,
          message: "ownerNewBooking",
          state: settings.ownerPhone ? "pending" : "skipped",
          reason: settings.ownerPhone ? null : "noOwnerPhone",
        })
      }
      if (reachable) {
        const reminders = planReminders({
          bookedAt: new Date(booking.createdAt),
          startAt: new Date(booking.startAt),
          reminders: settings.reminders,
          quietStart: settings.quietStart,
          quietEnd: settings.quietEnd,
          timeZone: business.timezone,
        })
        for (const { minutes, dueAt } of reminders) {
          out.push({
            ...base,
            message: "reminder",
            reminderMinutes: minutes,
            dueAt: dueAt.toISOString(),
            state: "pending",
          })
        }
      }
      return out
    })
    if (rows.length) await db.insert(notificationSends).values(rows).onConflictDoNothing()

    // Moved since the last plan (decision D5): one "changed" row at the
    // booking's current moves, which also marks the move as planned. It goes
    // only if the customer was told of the booking; else a confirmation still
    // waiting goes with the new time. Reminders are planned again for the new
    // time (the move skipped the old ones).
    const moved = await db
      .select({ booking: bookings, told: confirmed.id })
      .from(bookings)
      .leftJoin(
        changed,
        and(
          eq(changed.bookingId, bookings.id),
          eq(changed.message, "changed"),
          eq(changed.moves, bookings.moves)
        )
      )
      .leftJoin(
        confirmed,
        and(
          eq(confirmed.bookingId, bookings.id),
          eq(confirmed.message, "confirmed"),
          eq(confirmed.state, "sent"),
          // Sent before this move: a confirmation still waiting at the move
          // went with the new time already.
          lt(confirmed.moves, bookings.moves)
        )
      )
      .where(
        and(
          eq(bookings.businessId, businessId),
          ne(bookings.status, "cancelled"),
          gt(bookings.moves, 0),
          gt(bookings.startAt, now.toISOString()),
          gte(bookings.createdAt, since),
          isNull(changed.id)
        )
      )
    const moves: Send[] = moved.flatMap(({ booking, told }) => {
      const base = { businessId, bookingId: booking.id, moves: booking.moves }
      const reachable = booking.whatsappOptIn && booking.customerPhone
      const notReached = booking.customerPhone ? "noOptIn" : "noPhone"
      const out: Send[] = [
        {
          ...base,
          message: "changed",
          dueAt: now.toISOString(),
          state: told && reachable ? "pending" : "skipped",
          reason: !told ? "notTold" : reachable ? null : notReached,
        },
      ]
      if (reachable) {
        const reminders = planReminders({
          bookedAt: now,
          startAt: new Date(booking.startAt),
          reminders: settings.reminders,
          quietStart: settings.quietStart,
          quietEnd: settings.quietEnd,
          timeZone: business.timezone,
        })
        for (const { minutes, dueAt } of reminders) {
          out.push({
            ...base,
            message: "reminder",
            reminderMinutes: minutes,
            dueAt: dueAt.toISOString(),
            state: "pending",
          })
        }
      }
      return out
    })
    if (moves.length) await db.insert(notificationSends).values(moves).onConflictDoNothing()

    // Cancelled since the customer was told of the booking.
    const gone = await db
      .select({ id: bookings.id, moves: bookings.moves })
      .from(bookings)
      .innerJoin(
        confirmed,
        and(
          eq(confirmed.bookingId, bookings.id),
          eq(confirmed.message, "confirmed"),
          eq(confirmed.state, "sent")
        )
      )
      .leftJoin(
        cancelled,
        and(eq(cancelled.bookingId, bookings.id), eq(cancelled.message, "cancelled"))
      )
      .where(
        and(
          eq(bookings.businessId, businessId),
          eq(bookings.status, "cancelled"),
          gt(bookings.startAt, now.toISOString()),
          isNull(cancelled.id)
        )
      )
    if (gone.length) {
      await db
        .insert(notificationSends)
        .values(
          gone.map(({ id, moves }) => ({
            businessId,
            bookingId: id,
            moves,
            message: "cancelled" as const,
            dueAt: now.toISOString(),
            state: "pending" as const,
          }))
        )
        .onConflictDoNothing()
    }

    // A message to the customer failed: the owner hears of it once per
    // booking and move, while the visit is still ahead.
    const failed = await db
      .selectDistinct({
        id: bookings.id,
        moves: notificationSends.moves,
        customerName: bookings.customerName,
        serviceName: bookings.serviceName,
        startAt: bookings.startAt,
      })
      .from(notificationSends)
      .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
      .leftJoin(
        alerted,
        and(
          eq(alerted.bookingId, notificationSends.bookingId),
          eq(alerted.message, "ownerFailed"),
          eq(alerted.moves, notificationSends.moves)
        )
      )
      .where(
        and(
          eq(notificationSends.businessId, businessId),
          eq(notificationSends.state, "failed"),
          inArray(notificationSends.message, ALERT_ON_FAILURE),
          gt(bookings.startAt, now.toISOString()),
          isNull(alerted.id)
        )
      )
    if (failed.length) {
      // The owner's bell hears it too, saved with the alert's rows.
      const notices = await Promise.all(
        failed.map(({ id, moves, customerName, serviceName, startAt }) =>
          notification(
            businessId,
            "messageFailed",
            { customerName, serviceName, startAt },
            { dedupeKey: `messageFailed:${id}:${moves}` }
          )
        )
      )
      await saveAll([
        db
          .insert(notificationSends)
          .values(
            failed.map(({ id, moves }) => ({
              businessId,
              bookingId: id,
              moves,
              message: "ownerFailed" as const,
              dueAt: now.toISOString(),
              state: settings.ownerPhone ? ("pending" as const) : ("skipped" as const),
              reason: settings.ownerPhone ? null : "noOwnerPhone",
            }))
          )
          .onConflictDoNothing(),
        ...notices.flat(),
      ])
    }

    // A cancelled booking's other waiting messages never go.
    await db
      .update(notificationSends)
      .set({ state: "skipped", reason: "cancelled" })
      .where(
        and(
          eq(notificationSends.state, "pending"),
          notInArray(notificationSends.message, [...AFTER_CANCEL]),
          inArray(
            notificationSends.bookingId,
            db
              .select({ id: bookings.id })
              .from(bookings)
              .where(and(eq(bookings.businessId, businessId), eq(bookings.status, "cancelled")))
          )
        )
      )
  }
}

// The person's last message to the number Book sends from, for Meta's window.
async function windowOpen(
  workspaceId: string,
  phoneNumberId: string,
  phone: string,
  now: Date,
  rules: NotificationRules
) {
  const [row] = await db
    .select({ lastReplyAt: chatReplies.lastReplyAt })
    .from(chatReplies)
    .where(
      and(
        eq(chatReplies.workspaceId, workspaceId),
        eq(chatReplies.phoneNumberId, phoneNumberId),
        eq(chatReplies.customerPhone, phone)
      )
    )
    .limit(1)
  return !!row && Date.parse(row.lastReplyAt) > now.getTime() - rules.freeTextMinutes * MINUTE
}

// WhatsApp's limit for a reply button's title on a normal message (Chat's
// send API, wapi-api docs/api/oauth.md); a template's buttons allow more.
const INTERACTIVE_BUTTON_TITLE = 20

type Contact = { data?: { _id?: string; is_unsubscribed?: boolean } }
type Sent = { data?: { id?: string; _id?: string } }

type Outcome =
  | { state: "sent"; via: "text" | "template"; chatRecordId: string | null; sender: Sender }
  // `sender`: the number it was tried from, once one was picked.
  | { state: "failed" | "skipped"; reason: string; sender?: Sender }
  // Nothing reached WhatsApp (Chat could not be asked): tried again next time.
  | { state: "pending" }

async function deliver(
  send: typeof notificationSends.$inferSelect,
  now: Date,
  refreshed: Set<string>,
  rules: NotificationRules
): Promise<Outcome> {
  const [row] = await db
    .select({ booking: bookings, business: businesses })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.id, send.bookingId))
    .limit(1)
  if (!row) return { state: "skipped", reason: "notConnected" }
  const { booking, business } = row

  const settings = await notificationSettingsFor(business.id)
  const kind = send.message
  const off = kind === "thankYou" ? !settings.thankYouReply : settings.turnedOff.includes(kind)
  if (off) return { state: "skipped", reason: "turnedOff" }
  const toOwner = isOwnerAlert(kind)
  const phone = toOwner ? settings.ownerPhone : booking.customerPhone
  const line = await lineFor(
    business.id,
    settings.turnedOff,
    phone
      ? {
          digits: phone.replace(/\D/g, ""),
          useWindow: kind === "thankYou" || settings.freeTextInWindow,
          now,
          rules,
        }
      : undefined
  )
  if (line === "wait") return { state: "pending" }
  if (!line) return { state: "skipped", reason: "notConnected" }
  if (booking.status === "cancelled" && !AFTER_CANCEL.includes(kind)) {
    return { state: "skipped", reason: "cancelled" }
  }
  if (Date.parse(booking.startAt) <= now.getTime()) return { state: "skipped", reason: "late" }
  if (!phone) return { state: "skipped", reason: toOwner ? "noOwnerPhone" : "noPhone" }
  const language: TemplateLanguage = toOwner ? settings.ownerLanguage : booking.language ?? "en"
  const at = localDateTime(new Date(booking.startAt), business.timezone)
  const values = bookingValues(
    {
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      serviceName: booking.serviceName,
      teamMemberName: booking.teamMemberName,
      durationMinutes: booking.durationMinutes,
      priceMinor: booking.priceMinor,
      currency: booking.currency,
      businessName: business.name,
      businessAddress: business.address,
      date: at.date,
      time: at.time,
    },
    language
  )

  if (kind === "thankYou") {
    return sendThankYou({
      line,
      phone,
      contactName: booking.customerName,
      text: thankYouMessage(language, values),
      now,
      rules,
    })
  }

  return sendMessage({
    businessId: business.id,
    line,
    phone,
    contactName: toOwner ? business.name : booking.customerName,
    message: kind,
    language,
    values,
    freeTextInWindow: settings.freeTextInWindow,
    now,
    rules,
    refreshed,
  })
}

type Target = {
  businessId: string
  line: Line
  phone: string
  contactName: string
  message: BookingMessage
  language: TemplateLanguage
  values: Record<BookingField, string>
  freeTextInWindow: boolean
  now: Date
  rules: NotificationRules
  refreshed: Set<string>
}

// One message to one person from the line's number.
async function sendMessage({
  businessId,
  line,
  phone,
  contactName,
  message,
  language,
  values,
  freeTextInWindow,
  now,
  rules,
  refreshed,
}: Target): Promise<Outcome> {
  const { sender, workspaceId, phoneNumberId } = line
  // Koblip's number sends Koblip's ready-made set; the business's own, its
  // own copies in its wording.
  const sendable = () =>
    sender === "koblip"
      ? koblipSendableTemplate(message, language)
      : sendableTemplate(businessId, message, language)
  let { template, approved } = await sendable()
  const digits = phone.replace(/\D/g, "")
  // Inside the 24-hour window a normal message goes (free), unless the owner
  // turned that off. Its buttons go too when WhatsApp takes their titles;
  // else the approved template carries them, or the words go alone.
  const inWindow =
    freeTextInWindow && (await windowOpen(workspaceId, phoneNumberId, digits, now, rules))
  if (sender === "own" && !inWindow && !approved && !refreshed.has(businessId)) {
    // Book's copy of Meta's review may be behind: ask Chat once per check.
    refreshed.add(businessId)
    await refreshChatTemplates(businessId)
    ;({ template, approved } = await sendable())
  }
  if (!inWindow && !approved) return { state: "failed", reason: "templateNotApproved", sender }
  const buttonsFit = template.buttons.every(({ label }) => label.length <= INTERACTIVE_BUTTON_TITLE)
  let text = inWindow && (buttonsFit || !approved)

  // Koblip's number sends a business at most its monthly templates (D3,
  // K6); past that, inside the window the words still go alone (free).
  // The owner's bell hears once a month when the limit is near and when it
  // is reached.
  if (sender === "koblip" && !text) {
    const { koblipMonthlyTemplates: limit, koblipLimitNearPercent } = await notificationRules(businessId)
    const sent = await koblipTemplatesSent(businessId, now)
    const month = usageMonth(now).start.slice(0, 7)
    if (sent >= limit) {
      await notify(businessId, "koblipLimitReached", { sent, limit }, { dedupeKey: `koblipLimitReached:${month}` })
      if (!inWindow) return { state: "skipped", reason: "monthlyLimit", sender }
      text = true
    } else if (sent + 1 >= Math.ceil((limit * koblipLimitNearPercent) / 100)) {
      await notify(businessId, "koblipLimitNear", { sent: sent + 1, limit }, { dedupeKey: `koblipLimitNear:${month}` })
    }
  }

  // The template goes exactly as Meta approved it, with its own fields.
  return post(line, digits, contactName, text ? "text" : "template", (recipient) =>
    text && template.buttons.length && buttonsFit
      ? {
          ...recipient,
          messageType: "interactive",
          interactiveType: "button",
          messageText: withValues(template.body, values),
          buttonParams: template.buttons.map(({ action, label }) => ({ id: action, title: label })),
          buttonHeader: withValues(template.header, values),
          ...(template.footer ? { buttonFooter: template.footer } : {}),
        }
      : text || !approved
        ? { ...recipient, messageType: "text", messageText: plainMessage(template, values) }
        : {
            ...recipient,
            messageType: "template",
            template_id: approved.chatTemplateId,
            templateName: approved.template.name,
            languageCode: approved.template.language,
            templateVariables: Object.fromEntries(
              approved.template.fields.map((field, index) => [String(index + 1), values[field]])
            ),
          }
  )
}

// The thank-you after a tap (D24): a normal message, only while the
// customer's 24-hour window with the line's number is open; it has no
// template to fall back on.
async function sendThankYou({
  line,
  phone,
  contactName,
  text,
  now,
  rules,
}: Pick<Target, "line" | "phone" | "contactName" | "now" | "rules"> & {
  text: string
}): Promise<Outcome> {
  const digits = phone.replace(/\D/g, "")
  if (!(await windowOpen(line.workspaceId, line.phoneNumberId, digits, now, rules))) {
    return { state: "skipped", reason: "windowClosed", sender: line.sender }
  }
  return post(line, digits, contactName, "text", (recipient) => ({
    ...recipient,
    messageType: "text",
    messageText: text,
  }))
}

type Recipient = { contact_id: string; whatsapp_phone_number_id: string }

// The person as a contact in the line's Koblip Chat, then the message.
// Chat keeps who opted out (D18): an opted-out contact gets nothing.
async function post(
  { sender, phoneNumberId, call }: Line,
  digits: string,
  contactName: string,
  via: "text" | "template",
  body: (recipient: Recipient) => Record<string, unknown>
): Promise<Outcome> {
  let contact: Contact
  try {
    contact = await call<Contact>("/api/contacts/find-or-create", {
      method: "POST",
      body: { phone_number: digits, name: contactName },
    })
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    // A refused number will be refused again; anything else may pass later.
    if (error.status === 400) return { state: "failed", reason: "badPhone", sender }
    console.error(error)
    return { state: "pending" }
  }
  const contactId = contact.data?._id
  if (!contactId) return { state: "failed", reason: "chat", sender }
  if (contact.data?.is_unsubscribed) return { state: "skipped", reason: "unsubscribed", sender }

  try {
    const sent = await call<Sent>("/api/whatsapp/send", {
      method: "POST",
      body: body({ contact_id: contactId, whatsapp_phone_number_id: phoneNumberId }),
    })
    return { state: "sent", via, chatRecordId: sent.data?.id ?? sent.data?._id ?? null, sender }
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    console.error(error)
    // It may have gone: never sent again.
    return { state: "failed", reason: error.code ?? "chat", sender }
  }
}

// "Send a test to my phone": one message with sample values to the owner's
// WhatsApp, in the owner's language, now. Not a booking's message, so it has
// no row and no Activity entry; the result says how it went.
export async function sendTestMessage(
  businessId: string,
  message: BookingMessage,
  now = new Date()
): Promise<Outcome> {
  const settings = await notificationSettingsFor(businessId)
  const rules = await notificationRules(businessId)
  const line = await lineFor(
    businessId,
    settings.turnedOff,
    settings.ownerPhone
      ? {
          digits: settings.ownerPhone.replace(/\D/g, ""),
          useWindow: settings.freeTextInWindow,
          now,
          rules,
        }
      : undefined
  )
  if (!line || line === "wait") return { state: "skipped", reason: "notConnected" }
  if (!settings.ownerPhone) return { state: "skipped", reason: "noOwnerPhone" }
  const [business] = await db
    .select({ name: businesses.name, address: businesses.address })
    .from(businesses)
    .where(eq(businesses.id, businessId))
  const values = exampleValues(settings.ownerLanguage)
  if (business) values.business = business.name
  if (business?.address) values.address = business.address
  return sendMessage({
    businessId,
    line,
    phone: settings.ownerPhone,
    contactName: business?.name ?? values.business,
    message,
    language: settings.ownerLanguage,
    values,
    freeTextInWindow: settings.freeTextInWindow,
    now,
    rules,
    refreshed: new Set(),
  })
}

// Sends what is due, each row once. Only the kinds the sender knows are
// taken; any other waits as pending until it does.
async function sendDue(now: Date, rules: NotificationRules) {
  const due = await db
    .select()
    .from(notificationSends)
    .where(
      and(
        eq(notificationSends.state, "pending"),
        lte(notificationSends.dueAt, now.toISOString()),
        inArray(notificationSends.message, [...SEND_KINDS])
      )
    )
    .orderBy(asc(notificationSends.dueAt))
    .limit(rules.sendBatch)
  const refreshed = new Set<string>()

  for (const send of due) {
    const claimed = await db
      .update(notificationSends)
      .set({ state: "sending" })
      .where(and(eq(notificationSends.id, send.id), eq(notificationSends.state, "pending")))
      .returning({ id: notificationSends.id })
    if (!claimed.length) continue

    let outcome: Outcome
    try {
      outcome = await deliver(send, now, refreshed, rules)
    } catch (error) {
      console.error(error)
      outcome = { state: "failed", reason: "error" }
    }
    await db
      .update(notificationSends)
      .set(
        outcome.state === "sent"
          ? { ...outcome, reason: null, sentAt: new Date().toISOString() }
          : outcome.state === "pending"
            ? { state: "pending" }
            : { state: outcome.state, reason: outcome.reason, sender: outcome.sender }
      )
      .where(eq(notificationSends.id, send.id))
  }
}

// Rows left "sending" when the server stopped mid-send: they may have gone,
// so they are closed, never sent again.
async function closeStuck(now: Date, rules: NotificationRules) {
  await db
    .update(notificationSends)
    .set({ state: "failed", reason: "interrupted" })
    .where(
      and(
        eq(notificationSends.state, "sending"),
        lt(
          notificationSends.updatedAt,
          new Date(now.getTime() - rules.stuckSendingMinutes * MINUTE).toISOString()
        )
      )
    )
}

// One check: plan new messages, then send the due ones, under the rules as
// they stand (the admin's values over the defaults). Run by the server's
// timer (notification-timer.ts) every `sendEverySeconds`.
export async function runNotifications(now = new Date()) {
  const rules = await notificationRules()
  await closeStuck(now, rules)
  await plan(now)
  await sendDue(now, rules)
}
