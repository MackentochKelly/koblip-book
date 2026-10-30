import "server-only"
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"

import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  chatConnections,
  chatReplies,
  notificationSends,
} from "@/lib/db/schema"
import type { NotificationRules } from "@/lib/notification-rules"
import { notificationRules } from "@/lib/platform-settings"
import {
  BOOKING_MESSAGES,
  bookingValues,
  exampleValues,
  plainMessage,
  withValues,
  type BookingField,
  type BookingMessage,
  type TemplateLanguage,
} from "../utils/booking-templates"
import { localDateTime, planReminders } from "../utils/reminder-schedule"
import { ChatApiError, chatApi, chatConnectionUsable } from "./chat-oauth"
import { refreshChatTemplates, sendableTemplate } from "./chat-templates"
import { notificationSettingsFor } from "./notifications"

// Book's WhatsApp booking messages (docs/koblip-chat-integration.md, step 3),
// sent through the business's Koblip Chat with its public API: the person as
// a contact (POST /api/contacts/find-or-create), then the message
// (POST /api/whatsapp/send). Plain text inside Meta's 24-hour window, the
// approved template outside it.
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

// New rows for bookings made since the business connected: the confirmation,
// the owner's alert and the reminders; "Booking changed" and new reminders
// for bookings moved; and the cancellation note for bookings cancelled after
// their confirmation went.
async function plan(now: Date) {
  const confirmed = alias(notificationSends, "confirmed")
  const cancelled = alias(notificationSends, "cancelled")
  const changed = alias(notificationSends, "changed")

  for (const connection of await sendingConnections()) {
    const businessId = connection.businessId
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
          gte(bookings.createdAt, connection.createdAt),
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
          gte(bookings.createdAt, connection.createdAt),
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

    // A cancelled booking's other waiting messages never go.
    await db
      .update(notificationSends)
      .set({ state: "skipped", reason: "cancelled" })
      .where(
        and(
          eq(notificationSends.state, "pending"),
          ne(notificationSends.message, "cancelled"),
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

// The person's last message to the business's number, for Meta's window.
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
  | { state: "sent"; via: "text" | "template"; chatRecordId: string | null }
  | { state: "failed" | "skipped"; reason: string }
  // Nothing reached WhatsApp (Chat could not be asked): tried again next time.
  | { state: "pending" }

async function deliver(
  send: typeof notificationSends.$inferSelect,
  now: Date,
  refreshed: Set<string>,
  rules: NotificationRules
): Promise<Outcome> {
  const [row] = await db
    .select({ booking: bookings, business: businesses, connection: chatConnections })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(chatConnections, eq(chatConnections.businessId, bookings.businessId))
    .where(eq(bookings.id, send.bookingId))
    .limit(1)
  if (!row) return { state: "skipped", reason: "notConnected" }
  const { booking, business, connection } = row
  if (!chatConnectionUsable(connection) || !connection.phoneNumberId) return { state: "pending" }

  const settings = await notificationSettingsFor(business.id)
  const message = send.message as BookingMessage
  if (settings.turnedOff.includes(message)) return { state: "skipped", reason: "turnedOff" }
  if (booking.status === "cancelled" && message !== "cancelled") {
    return { state: "skipped", reason: "cancelled" }
  }
  if (Date.parse(booking.startAt) <= now.getTime()) return { state: "skipped", reason: "late" }

  const toOwner = message === "ownerNewBooking"
  const phone = toOwner ? settings.ownerPhone : booking.customerPhone
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

  return sendMessage({
    businessId: business.id,
    workspaceId: connection.workspaceId,
    phoneNumberId: connection.phoneNumberId,
    phone,
    contactName: toOwner ? business.name : booking.customerName,
    message,
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
  workspaceId: string
  phoneNumberId: string
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

// One message to one person through the business's Koblip Chat.
async function sendMessage({
  businessId,
  workspaceId,
  phoneNumberId,
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
  let { template, approved } = await sendableTemplate(businessId, message, language)
  const digits = phone.replace(/\D/g, "")
  // Inside the 24-hour window a normal message goes (free), unless the owner
  // turned that off. Its buttons go too when WhatsApp takes their titles;
  // else the approved template carries them, or the words go alone.
  const inWindow =
    freeTextInWindow && (await windowOpen(workspaceId, phoneNumberId, digits, now, rules))
  if (!inWindow && !approved && !refreshed.has(businessId)) {
    // Book's copy of Meta's review may be behind: ask Chat once per check.
    refreshed.add(businessId)
    await refreshChatTemplates(businessId)
    ;({ template, approved } = await sendableTemplate(businessId, message, language))
  }
  if (!inWindow && !approved) return { state: "failed", reason: "templateNotApproved" }
  const buttonsFit = template.buttons.every(({ label }) => label.length <= INTERACTIVE_BUTTON_TITLE)
  const text = inWindow && (buttonsFit || !approved)

  let contact: Contact
  try {
    contact = await chatApi<Contact>(businessId, "/api/contacts/find-or-create", {
      method: "POST",
      body: { phone_number: digits, name: contactName },
    })
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    // A refused number will be refused again; anything else may pass later.
    if (error.status === 400) return { state: "failed", reason: "badPhone" }
    console.error(error)
    return { state: "pending" }
  }
  const contactId = contact.data?._id
  if (!contactId) return { state: "failed", reason: "chat" }
  if (contact.data?.is_unsubscribed) return { state: "skipped", reason: "unsubscribed" }

  const base = { contact_id: contactId, whatsapp_phone_number_id: phoneNumberId }
  // The template goes exactly as Meta approved it, with its own fields.
  const body = text && template.buttons.length && buttonsFit
    ? {
        ...base,
        messageType: "interactive",
        interactiveType: "button",
        messageText: withValues(template.body, values),
        buttonParams: template.buttons.map(({ action, label }) => ({ id: action, title: label })),
        buttonHeader: withValues(template.header, values),
        ...(template.footer ? { buttonFooter: template.footer } : {}),
      }
    : text || !approved
    ? { ...base, messageType: "text", messageText: plainMessage(template, values) }
    : {
        ...base,
        messageType: "template",
        template_id: approved.chatTemplateId,
        templateName: approved.template.name,
        languageCode: approved.template.language,
        templateVariables: Object.fromEntries(
          approved.template.fields.map((field, index) => [String(index + 1), values[field]])
        ),
      }
  try {
    const sent = await chatApi<Sent>(businessId, "/api/whatsapp/send", { method: "POST", body })
    return {
      state: "sent",
      via: text ? "text" : "template",
      chatRecordId: sent.data?.id ?? sent.data?._id ?? null,
    }
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    console.error(error)
    // It may have gone: never sent again.
    return { state: "failed", reason: error.code ?? "chat" }
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
  const [connection] = await db
    .select()
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (!connection) return { state: "skipped", reason: "notConnected" }
  if (!chatConnectionUsable(connection) || !connection.phoneNumberId) {
    return { state: "skipped", reason: "notConnected" }
  }
  const settings = await notificationSettingsFor(businessId)
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
    workspaceId: connection.workspaceId,
    phoneNumberId: connection.phoneNumberId,
    phone: settings.ownerPhone,
    contactName: business?.name ?? values.business,
    message,
    language: settings.ownerLanguage,
    values,
    freeTextInWindow: settings.freeTextInWindow,
    now,
    rules: await notificationRules(businessId),
    refreshed: new Set(),
  })
}

// Sends what is due, each row once. Only the messages Book can send yet are
// taken; any other kind waits as pending until the sender knows it.
async function sendDue(now: Date, rules: NotificationRules) {
  const due = await db
    .select()
    .from(notificationSends)
    .where(
      and(
        eq(notificationSends.state, "pending"),
        lte(notificationSends.dueAt, now.toISOString()),
        inArray(notificationSends.message, [...BOOKING_MESSAGES])
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
            : { state: outcome.state, reason: outcome.reason }
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
