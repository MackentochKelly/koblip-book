import "server-only"

import { and, count, desc, eq } from "drizzle-orm"

import type { ClientReminderChannel } from "@/lib/client-reminder-channels"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  clientNotificationSettings,
  emailSends,
  user,
} from "@/lib/db/schema"
import type { EmailSendState } from "@/lib/email-rules"

// How clients get their visit reminders (docs/plans/client-account.md,
// D16): how many picked each way, and every reminder email, newest first.
// Nothing hidden.

export type AdminReminderEmail = {
  id: string
  clientName: string | null
  businessName: string
  serviceName: string
  timezone: string
  startAt: string
  state: EmailSendState
  at: string
}

export type AdminClientReminders = {
  channels: { channel: ClientReminderChannel; accounts: number }[]
  emails: AdminReminderEmail[]
}

export async function getClientReminders(limit = 200): Promise<AdminClientReminders> {
  await requireAdmin()
  const [channels, emails] = await Promise.all([
    db
      .select({
        channel: clientNotificationSettings.reminderChannel,
        accounts: count(),
      })
      .from(clientNotificationSettings)
      .groupBy(clientNotificationSettings.reminderChannel),
    db
      .select({
        id: emailSends.id,
        clientName: user.name,
        businessName: businesses.name,
        serviceName: bookings.serviceName,
        timezone: businesses.timezone,
        startAt: bookings.startAt,
        state: emailSends.state,
        at: emailSends.createdAt,
      })
      .from(emailSends)
      .innerJoin(
        bookings,
        and(eq(bookings.id, emailSends.bookingId), eq(emailSends.kind, "clientReminder"))
      )
      .innerJoin(businesses, eq(businesses.id, bookings.businessId))
      .leftJoin(user, eq(user.id, emailSends.userId))
      .orderBy(desc(emailSends.createdAt))
      .limit(limit),
  ])
  return { channels, emails }
}
