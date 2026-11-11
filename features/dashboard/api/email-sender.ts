import "server-only"
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"

import { APP_NAME } from "@/lib/app-install"
import { calendarFile } from "@/lib/booking-calendar"
import { bookingAccount, bookingReminderPick } from "@/lib/client-reminders"
import { db } from "@/lib/db"
import { bookings, businesses, emailSends, notificationSends, user } from "@/lib/db/schema"
import { claimPlannedEmail, deliverEmail, settleEmail, type EmailMessage } from "@/lib/email"
import { renderEmail, type EmailLine } from "@/lib/email-layout"
import {
  OWNER_EMAILS,
  isBookingEmail,
  type BookingEmail,
  type EmailKind,
} from "@/lib/email-rules"
import { stopLinks } from "@/lib/email-stop"
import { emailWords } from "@/lib/email-templates"
import { accountBookingHref, bookAgainHref } from "@/lib/my-bookings-links"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { hasFeature } from "@/lib/plan-access"
import { notificationRules } from "@/lib/platform-settings"
import type { NotificationSettings } from "../types/notifications"
import { bookingValues } from "../utils/booking-templates"
import { localDateTime, planReminders } from "../utils/reminder-schedule"
import { bookWordsFor, durationWordsFor } from "./message-words"
import { notificationSettingsFor } from "./notifications"

// A booking's emails (docs/plans/email.md, EM-D6 to EM-D13): to the
// customer, confirmed, reminder, changed and cancelled; to the owner, new
// booking, customer can't come and customer cancelled.
//
// Like WhatsApp's messages (notification-sender.ts), each email is planned
// as an email_sends row when the booking is made, moved or cancelled, once
// per booking, kind, reminder time and move (a unique index), and the timer
// sends the rows that are due, each claimed (pending → sending) first, so
// none goes twice.

const MINUTE = 60_000

type Send = typeof emailSends.$inferInsert
type Booking = typeof bookings.$inferSelect
type Business = typeof businesses.$inferSelect

const OWNER_KINDS: readonly EmailKind[] = OWNER_EMAILS

// Which words each email uses (appServer.emails.booking).
const WORDS = {
  bookingConfirmed: "confirmed",
  clientReminder: "reminder",
  bookingChanged: "changed",
  bookingCancelled: "cancelled",
  ownerNewBooking: "ownerNewBooking",
  ownerCantCome: "ownerCantCome",
  ownerCancelled: "ownerCancelled",
} as const satisfies Record<BookingEmail, string>

type BookingEmailKind = BookingEmail

// The account the booking is the customer's in, and that account's email.
const accountEmail = sql<string | null>`(select ${user.email} from ${user} where ${user.id} = ${bookingAccount})`

// Whether the booking already has an email of this kind (at its current
// move, when `sameMove`).
function hasEmail(kind: EmailKind, sameMove = false) {
  return sql`exists (select 1 from ${emailSends} where ${emailSends.bookingId} = ${bookings.id} and ${emailSends.kind} = ${kind}${
    sameMove ? sql` and ${emailSends.moves} = ${bookings.moves}` : sql``
  })`
}

// Who reads the customer's emails: the email on the booking, else its
// account's, unless that account was made with a phone (no real email).
function customerAddress(booking: { customerEmail: string | null }, account: string | null) {
  if (booking.customerEmail) return booking.customerEmail
  return account && !isPhoneAccountEmail(account) ? account : null
}

function ownerAddress(email: string | null) {
  return email && !isPhoneAccountEmail(email) ? email : null
}

// EM-D8: a reminder goes by email when the client picked email, or, with no
// pick, when WhatsApp can't reach the booking. Nobody is reminded twice.
const wantsEmailReminder = or(
  eq(bookingReminderPick, "email"),
  and(
    isNull(bookingReminderPick),
    or(eq(bookings.whatsappOptIn, false), isNull(bookings.customerPhone))
  )
)

const live = (now: Date) =>
  and(eq(businesses.isDemo, false), gt(bookings.startAt, now.toISOString()))

async function plan(now: Date, windowMinutes: number) {
  const nowIso = now.toISOString()
  const since = new Date(now.getTime() - windowMinutes * MINUTE).toISOString()
  const settings = new Map<string, Promise<NotificationSettings>>()
  const settingsOf = (businessId: string) => {
    let found = settings.get(businessId)
    if (!found) {
      found = notificationSettingsFor(businessId)
      settings.set(businessId, found)
    }
    return found
  }
  const owner = alias(user, "owner")
  const rows: Send[] = []
  const base = (booking: Booking, email: string, userId: string | null) => ({
    email: email.toLowerCase(),
    userId,
    businessId: booking.businessId,
    bookingId: booking.id,
    moves: booking.moves,
    dueAt: nowIso,
  })

  // Made since the window began: the customer's confirmation.
  const fresh = await db
    .select({ booking: bookings, accountId: bookingAccount, account: accountEmail })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        live(now),
        ne(bookings.status, "cancelled"),
        gte(bookings.createdAt, since),
        sql`not ${hasEmail("bookingConfirmed")}`
      )
    )
  for (const { booking, accountId, account } of fresh) {
    const email = customerAddress(booking, account)
    if (!email) continue
    rows.push({
      ...base(booking, email, accountId),
      kind: "bookingConfirmed",
      language: booking.language,
      state: "pending",
    })
  }

  // Moved since the last plan: "Booking changed", only when the customer got
  // the confirmation before this move; else the next email has the new time.
  const moved = await db
    .select({
      booking: bookings,
      accountId: bookingAccount,
      account: accountEmail,
      told: sql<number>`exists (select 1 from ${emailSends} where ${emailSends.bookingId} = ${bookings.id} and ${emailSends.kind} = 'bookingConfirmed' and ${emailSends.state} = 'sent' and ${emailSends.moves} < ${bookings.moves})`,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        live(now),
        ne(bookings.status, "cancelled"),
        gt(bookings.moves, 0),
        hasEmail("bookingConfirmed"),
        sql`not ${hasEmail("bookingChanged", true)}`
      )
    )
  for (const { booking, accountId, account, told } of moved) {
    const email = customerAddress(booking, account)
    if (!email) continue
    rows.push({
      ...base(booking, email, accountId),
      kind: "bookingChanged",
      language: booking.language,
      state: told ? "pending" : "skipped",
      reason: told ? null : "notTold",
    })
  }

  // Cancelled after the customer got the confirmation, while still ahead.
  const gone = await db
    .select({ booking: bookings, accountId: bookingAccount, account: accountEmail })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        live(now),
        eq(bookings.status, "cancelled"),
        sql`exists (select 1 from ${emailSends} where ${emailSends.bookingId} = ${bookings.id} and ${emailSends.kind} = 'bookingConfirmed' and ${emailSends.state} = 'sent')`,
        sql`not ${hasEmail("bookingCancelled")}`
      )
    )
  for (const { booking, accountId, account } of gone) {
    const email = customerAddress(booking, account)
    if (!email) continue
    rows.push({
      ...base(booking, email, accountId),
      kind: "bookingCancelled",
      language: booking.language,
      state: "pending",
    })
  }

  // Reminders at the business's times and quiet hours (EM-D9), planned once
  // per move: from when it was booked, or from now for a move.
  const toRemind = await db
    .select({
      booking: bookings,
      timezone: businesses.timezone,
      accountId: bookingAccount,
      account: accountEmail,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        live(now),
        ne(bookings.status, "cancelled"),
        wantsEmailReminder,
        sql`not ${hasEmail("clientReminder", true)}`
      )
    )
  for (const { booking, timezone, accountId, account } of toRemind) {
    const email = customerAddress(booking, account)
    if (!email) continue
    const { reminders, quietStart, quietEnd } = await settingsOf(booking.businessId)
    const planned = planReminders({
      bookedAt: booking.moves > 0 ? now : new Date(booking.createdAt),
      startAt: new Date(booking.startAt),
      reminders,
      quietStart,
      quietEnd,
      timeZone: timezone,
    })
    for (const { minutes, dueAt } of planned) {
      // A time long gone (a booking made before email reminders) is skipped.
      if (dueAt.getTime() < Date.parse(since)) continue
      rows.push({
        ...base(booking, email, accountId),
        kind: "clientReminder",
        reminderMinutes: minutes,
        dueAt: dueAt.toISOString(),
        language: booking.language,
        state: "pending",
      })
    }
  }

  // The owner: bookings customers made (not their own), to their account's
  // email, in their language.
  const booked = await db
    .select({ booking: bookings, ownerId: owner.id, ownerEmail: owner.email })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(owner, eq(owner.id, businesses.ownerId))
    .where(
      and(
        live(now),
        ne(bookings.status, "cancelled"),
        eq(bookings.source, "online"),
        gte(bookings.createdAt, since),
        sql`not ${hasEmail("ownerNewBooking")}`
      )
    )
  // A customer who can't come or cancelled: from the alert the app raised
  // (lib/customer-cant-come.ts), once per booking and move.
  const alerts = await db
    .select({
      booking: bookings,
      kind: notificationSends.message,
      moves: notificationSends.moves,
      ownerId: owner.id,
      ownerEmail: owner.email,
    })
    .from(notificationSends)
    .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(owner, eq(owner.id, businesses.ownerId))
    .where(
      and(
        live(now),
        inArray(notificationSends.message, ["ownerCantCome", "ownerCancelled"]),
        gte(notificationSends.createdAt, since),
        sql`not exists (select 1 from ${emailSends} where ${emailSends.bookingId} = ${bookings.id} and ${emailSends.kind} = ${notificationSends.message} and ${emailSends.moves} = ${notificationSends.moves})`
      )
    )
  const forOwner = [
    ...booked.map((row) => ({ ...row, kind: "ownerNewBooking" as const, moves: row.booking.moves })),
    ...alerts.flatMap((row) =>
      row.kind === "ownerCantCome" || row.kind === "ownerCancelled" ? [{ ...row, kind: row.kind }] : []
    ),
  ]
  for (const { booking, kind, moves, ownerId, ownerEmail } of forOwner) {
    const email = ownerAddress(ownerEmail)
    if (!email) continue
    const { ownerLanguage } = await settingsOf(booking.businessId)
    rows.push({
      ...base(booking, email, ownerId),
      moves,
      kind,
      language: ownerLanguage,
      state: "pending",
    })
  }

  // An email the owner turned off is kept as not sent, with the reason
  // (EM-D10), so its history says why.
  for (const row of rows) {
    if (!row.businessId || row.state !== "pending") continue
    const { emailTurnedOff } = await settingsOf(row.businessId)
    if (isBookingEmail(row.kind) && emailTurnedOff.includes(row.kind)) {
      row.state = "skipped"
      row.reason = "turnedOff"
    }
  }
  if (rows.length) await db.insert(emailSends).values(rows).onConflictDoNothing()

  // A cancelled booking's customer emails still waiting never go (the owner's
  // "customer cancelled" and the cancellation itself do).
  await db
    .update(emailSends)
    .set({ state: "skipped", reason: "cancelled" })
    .where(
      and(
        eq(emailSends.state, "pending"),
        inArray(emailSends.kind, ["bookingConfirmed", "clientReminder", "bookingChanged"]),
        inArray(
          emailSends.bookingId,
          db
            .select({ id: bookings.id })
            .from(bookings)
            .where(and(eq(bookings.status, "cancelled"), gt(bookings.startAt, nowIso)))
        )
      )
    )
}

// The email's lines, button, note and footer, in its language.
async function compose(
  kind: BookingEmailKind,
  booking: Booking,
  business: Business,
  to: string,
  language: NonNullable<Booking["language"]>
): Promise<EmailMessage> {
  const toOwner = OWNER_KINDS.includes(kind)
  const [t, words, duration] = await Promise.all([
    emailWords(language),
    bookWordsFor(language),
    durationWordsFor(language),
  ])
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
    words,
    duration
  )
  const key = WORDS[kind]
  const names = { name: booking.customerName, service: booking.serviceName, business: business.name }
  const site = process.env.BETTER_AUTH_URL ?? ""
  const label = (name: keyof typeof LINE_WORDS) => t(LINE_WORDS[name])
  const service: EmailLine = { label: label("service"), value: `${values.service}, ${values.duration}` }
  const when: EmailLine = { label: label("when"), value: t("booking.when", { date: values.date, time: values.time }) }
  const teamMember: EmailLine[] = booking.teamMemberName
    ? [{ label: label("teamMember"), value: booking.teamMemberName }]
    : []

  const lines: EmailLine[] = toOwner
    ? [
        { label: label("customer"), value: booking.customerName },
        service,
        when,
        ...teamMember,
        ...(booking.customerPhone ? [{ label: label("phone"), value: booking.customerPhone }] : []),
        ...(booking.customerEmail ? [{ label: label("email"), value: booking.customerEmail }] : []),
      ]
    : [
        service,
        when,
        ...teamMember,
        ...(business.address ? [{ label: label("address"), value: business.address }] : []),
        { label: label("price"), value: values.price },
      ]

  const account = booking.customerUserId
  const button = toOwner
    ? { label: t("booking.openBookings"), url: `${site}/dashboard/${business.id}/bookings` }
    : kind === "bookingCancelled"
      ? {
          label: t("booking.bookAgain"),
          url: `${site}${bookAgainHref(business.slug, booking.serviceId, language)}`,
        }
      : account
        ? { label: t("booking.seeBooking"), url: `${site}${accountBookingHref(booking.id)}` }
        : undefined

  const withCalendar = kind === "bookingConfirmed" || kind === "bookingChanged"
  const stop = toOwner ? null : stopLinks(to, business.id)
  const subject = t(`booking.${key}.subject`, names)
  const body = renderEmail({
    heading: business.name,
    title: t(`booking.${key}.title`),
    lead: t(`booking.${key}.lead`, names),
    lines,
    button,
    note: withCalendar ? t("booking.calendar") : undefined,
    footer: toOwner
      ? t("booking.ownerFooter", { business: business.name, app: APP_NAME })
      : t("booking.customerFooter", { business: business.name }),
    stop: stop ? { label: t("booking.stop"), url: stop.page } : undefined,
  })
  return {
    to,
    subject,
    ...body,
    // The customer's emails come from the business; the owner's from the app.
    fromName: toOwner ? undefined : business.name,
    attachments: withCalendar
      ? [
          {
            filename: "booking.ics",
            content: calendarFile({
              id: booking.id,
              title: `${booking.serviceName} · ${business.name}`,
              startAt: booking.startAt,
              endAt: booking.endAt,
              location: business.address,
              details: null,
            }),
            contentType: "text/calendar; charset=utf-8; method=PUBLISH",
          },
        ]
      : undefined,
    oneClickStop: stop?.oneClick,
  }
}

const LINE_WORDS = {
  service: "booking.lines.service",
  when: "booking.lines.when",
  teamMember: "booking.lines.teamMember",
  address: "booking.lines.address",
  price: "booking.lines.price",
  customer: "booking.lines.customer",
  phone: "booking.lines.phone",
  email: "booking.lines.email",
} as const

// Sends one due email, unless the booking changed since it was planned.
async function deliver(send: typeof emailSends.$inferSelect, now: Date) {
  const kind = send.kind
  if (!isBookingEmail(kind) || !send.bookingId) {
    await settleEmail(send.id, { state: "skipped", reason: "cancelled" })
    return
  }
  const [row] = await db
    .select({ booking: bookings, business: businesses })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.id, send.bookingId))
    .limit(1)
  if (!row) {
    await settleEmail(send.id, { state: "skipped", reason: "cancelled" })
    return
  }
  const { booking, business } = row
  const toOwner = OWNER_KINDS.includes(kind)
  const { emailTurnedOff } = await notificationSettingsFor(business.id)
  // Email reminders can be moved to a plan the business isn't on.
  const onPlan = kind !== "clientReminder" || (await hasFeature(business.id, "emailReminders"))
  // Turned off, not on the plan, cancelled, moved or too late since it was
  // planned.
  const reason = emailTurnedOff.includes(kind)
    ? "turnedOff"
    : !onPlan
      ? "notOnPlan"
      : !toOwner && kind !== "bookingCancelled" && booking.status === "cancelled"
      ? "cancelled"
      : (kind === "clientReminder" || kind === "bookingChanged") && send.moves !== booking.moves
        ? "moved"
        : Date.parse(booking.startAt) <= now.getTime()
          ? "late"
          : null
  if (reason) {
    await settleEmail(send.id, { state: "skipped", reason })
    return
  }
  const language = send.language ?? booking.language ?? "en"
  const message = await compose(kind, booking, business, send.email, language)
  // "Stop emails" is the customer's, for this business; the owner's own
  // emails are blocked only by a bounce or a complaint.
  await deliverEmail(send.id, message, toOwner ? null : business.id)
}

// Emails left "sending" by a server that stopped mid-send are marked failed:
// one may have gone, so none is tried again.
async function closeStuck(now: Date, stuckMinutes: number) {
  await db
    .update(emailSends)
    .set({ state: "failed", reason: "interrupted" })
    .where(
      and(
        eq(emailSends.state, "sending"),
        lt(emailSends.updatedAt, new Date(now.getTime() - stuckMinutes * MINUTE).toISOString())
      )
    )
}

async function sendDue(now: Date, batch: number) {
  const due = await db
    .select()
    .from(emailSends)
    .where(
      and(
        eq(emailSends.state, "pending"),
        isNotNull(emailSends.dueAt),
        lte(emailSends.dueAt, now.toISOString())
      )
    )
    .orderBy(asc(emailSends.dueAt))
    .limit(batch)
  for (const send of due) {
    if (!(await claimPlannedEmail(send.id))) continue
    try {
      await deliver(send, now)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      await settleEmail(send.id, { state: "failed", reason: "sendFailed" })
    }
  }
}

// One timer check (notification-timer.ts): close stuck sends, plan new
// emails, send what is due.
export async function runBookingEmails(now = new Date()) {
  const rules = await notificationRules()
  await closeStuck(now, rules.stuckSendingMinutes)
  await plan(now, rules.emailPlanWindowMinutes)
  await sendDue(now, rules.sendBatch)
}
