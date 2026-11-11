import "server-only"
import { and, eq, gt, isNull, lte, ne, sql } from "drizzle-orm"

import { DEFAULT_REMINDER_CHANNEL } from "@/lib/client-reminder-channels"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  clientNotificationSettings,
  emailSends,
  user,
} from "@/lib/db/schema"
import { claimEmail, deliverEmail } from "@/lib/email"
import { clientReminderEmail } from "@/lib/email-templates"
import { accountBookingHref } from "@/lib/my-bookings-links"
import { DEFAULT_LOCALES } from "@/lib/page-language"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import { notificationRules } from "@/lib/platform-settings"

// The account a booking belongs to: the one it was made or claimed with,
// else the one that proved the phone it was made with; null for neither.
export const bookingAccount = sql<string | null>`coalesce(${bookings.customerUserId}, (
  select ${user.id} from ${user}
  where ${user.phoneNumberVerified} = 1
    and 'p:' || replace(${user.phoneNumber}, '+', '') = ${bookings.customerKey}
  limit 1
))`

// How that account wants its reminders (D16); WhatsApp until it picks.
export const bookingReminderChannel = sql<string>`coalesce((
  select ${clientNotificationSettings.reminderChannel}
  from ${clientNotificationSettings}
  where ${clientNotificationSettings.userId} = ${bookingAccount}
), ${DEFAULT_REMINDER_CHANNEL})`

// The bookings whose client picked email or the bell only: the business's
// WhatsApp reminders skip them (its other messages still go).
export function noWhatsappReminders() {
  return db
    .select({ id: bookings.id })
    .from(bookings)
    .where(ne(bookingReminderChannel, "whatsapp"))
}

// Email reminders (D16), `clientReminderMinutes` before the visit like the
// bell's, for accounts that picked email and have a real email. One per
// booking and move: its email_sends row is written first, so a second
// timer never sends it again. The server's timer calls this on each check.
export async function emailClients(now = new Date()) {
  const { clientReminderMinutes } = await notificationRules()
  const lead = clientReminderMinutes * 60_000
  const due = await db
    .select({
      id: bookings.id,
      businessId: bookings.businessId,
      moves: bookings.moves,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      language: bookings.language,
      businessName: businesses.name,
      timezone: businesses.timezone,
      userId: user.id,
      email: user.email,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(user, eq(user.id, bookingAccount))
    .leftJoin(
      emailSends,
      and(
        eq(emailSends.bookingId, bookings.id),
        eq(emailSends.kind, "clientReminder"),
        eq(emailSends.moves, bookings.moves)
      )
    )
    .where(
      and(
        eq(businesses.isDemo, false),
        ne(bookings.status, "cancelled"),
        gt(bookings.startAt, now.toISOString()),
        lte(bookings.startAt, new Date(now.getTime() + lead).toISOString()),
        // Booked or moved after the reminder's time began: just told.
        lte(
          bookings.updatedAt,
          sql`strftime('%Y-%m-%dT%H:%M:%fZ', ${bookings.startAt}, ${`-${clientReminderMinutes} minutes`})`
        ),
        eq(bookingReminderChannel, "email"),
        isNull(emailSends.id)
      )
    )
  for (const booking of due) {
    if (isPhoneAccountEmail(booking.email)) continue
    const language = booking.language ?? "en"
    const sendId = await claimEmail(booking.email, {
      kind: "clientReminder",
      userId: booking.userId,
      businessId: booking.businessId,
      bookingId: booking.id,
      reminderMinutes: clientReminderMinutes,
      moves: booking.moves,
      language,
    })
    if (!sendId) continue
    const content = await clientReminderEmail({
      service: booking.serviceName,
      business: booking.businessName,
      when: new Intl.DateTimeFormat(DEFAULT_LOCALES[language], {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: booking.timezone,
      }).format(new Date(booking.startAt)),
      url: `${process.env.BETTER_AUTH_URL}${accountBookingHref(booking.id)}`,
      language,
    })
    await deliverEmail(sendId, { to: booking.email, ...content }, booking.businessId)
  }
}
