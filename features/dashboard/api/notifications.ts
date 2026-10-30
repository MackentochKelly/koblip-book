import "server-only"
import { desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  bookings,
  chatTemplates,
  notificationSends,
  notificationSettings,
  notificationTexts,
} from "@/lib/db/schema"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import type {
  NotificationMessage,
  NotificationSend,
  NotificationSettings,
  TemplateReview,
} from "../types/notifications"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  defaultWording,
} from "../utils/booking-templates"

// The business's WhatsApp notification settings, or the defaults.
export async function notificationSettingsFor(businessId: string): Promise<NotificationSettings> {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.businessId, businessId))
    .limit(1)
  return {
    ownerPhone: row?.ownerPhone ?? null,
    ownerLanguage: row?.ownerLanguage ?? "en",
    reminders: row?.reminders ?? [...NOTIFICATION_RULES.defaultReminders],
    quietStart: row?.quietStart ?? NOTIFICATION_RULES.defaultQuietStart,
    quietEnd: row?.quietEnd ?? NOTIFICATION_RULES.defaultQuietEnd,
    turnedOff: row?.turnedOff ?? [],
  }
}

function review(status: string | undefined): TemplateReview {
  if (!status) return "missing"
  if (status === "approved") return "approved"
  if (status === "rejected") return "rejected"
  return "waiting"
}

// Each message: on or off, and per language its wording (the owner's or
// Book's) and Meta's review.
export async function notificationMessagesFor(businessId: string): Promise<NotificationMessage[]> {
  const [settings, own, made] = await Promise.all([
    notificationSettingsFor(businessId),
    db.select().from(notificationTexts).where(eq(notificationTexts.businessId, businessId)),
    db.select().from(chatTemplates).where(eq(chatTemplates.businessId, businessId)),
  ])
  return BOOKING_MESSAGES.map((message) => ({
    message,
    on: !settings.turnedOff.includes(message),
    texts: Object.fromEntries(
      TEMPLATE_LANGUAGES.map((language) => {
        const mine = own.find((row) => row.message === message && row.language === language)
        const template = made.find((row) => row.message === message && row.language === language)
        return [
          language,
          {
            wording: mine
              ? { header: mine.header, body: mine.body, footer: mine.footer }
              : defaultWording(message, language),
            isDefault: !mine,
            review: review(template?.status),
          },
        ]
      })
    ) as NotificationMessage["texts"],
  }))
}

// The latest messages, newest first: what is waiting, sent, or was not sent
// and why.
export async function notificationHistoryFor(businessId: string): Promise<NotificationSend[]> {
  const rows = await db
    .select({
      id: notificationSends.id,
      message: notificationSends.message,
      customerName: bookings.customerName,
      dueAt: notificationSends.dueAt,
      sentAt: notificationSends.sentAt,
      state: notificationSends.state,
      reason: notificationSends.reason,
      delivery: notificationSends.delivery,
    })
    .from(notificationSends)
    .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
    .where(eq(notificationSends.businessId, businessId))
    .orderBy(desc(notificationSends.dueAt))
    .limit(NOTIFICATION_RULES.historySize)
  return rows.map(({ dueAt, sentAt, ...row }) => ({ ...row, at: sentAt ?? dueAt }))
}
