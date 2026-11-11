import "server-only"
import { ne, sql } from "drizzle-orm"

import { DEFAULT_REMINDER_CHANNEL } from "@/lib/client-reminder-channels"
import { db } from "@/lib/db"
import { bookings, clientNotificationSettings, user } from "@/lib/db/schema"

// The account a booking belongs to: the one it was made or claimed with,
// else the one that proved the phone it was made with; null for neither.
export const bookingAccount = sql<string | null>`coalesce(${bookings.customerUserId}, (
  select ${user.id} from ${user}
  where ${user.phoneNumberVerified} = 1
    and 'p:' || replace(${user.phoneNumber}, '+', '') = ${bookings.customerKey}
  limit 1
))`

// The account's own pick for its reminders (D16); null until it picks.
export const bookingReminderPick = sql<string | null>`(
  select ${clientNotificationSettings.reminderChannel}
  from ${clientNotificationSettings}
  where ${clientNotificationSettings.userId} = ${bookingAccount}
)`

// How that account wants its reminders; WhatsApp until it picks.
export const bookingReminderChannel = sql<string>`coalesce(${bookingReminderPick}, ${DEFAULT_REMINDER_CHANNEL})`

// The bookings whose client picked email or the bell only: the business's
// WhatsApp reminders skip them (its other messages still go).
export function noWhatsappReminders() {
  return db
    .select({ id: bookings.id })
    .from(bookings)
    .where(ne(bookingReminderChannel, "whatsapp"))
}
