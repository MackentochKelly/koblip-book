import "server-only"
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm"

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
  ActivityFilter,
  NotificationMessage,
  NotificationSend,
  NotificationSettings,
  NotificationText,
  TemplateReview,
} from "../types/notifications"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  defaultButtons,
  defaultWording,
  type TemplateLanguage,
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
    freeTextInWindow: row?.freeTextInWindow ?? NOTIFICATION_RULES.defaultFreeTextInWindow,
    cantCome: row?.cantCome ?? NOTIFICATION_RULES.defaultCantCome,
    thankYouReply: row?.thankYouReply ?? NOTIFICATION_RULES.defaultThankYouReply,
  }
}

type Submitted = (typeof chatTemplates.$inferSelect)["submitted"]

// Meta's review as the owner sees it: a message never submitted, or changed
// since it was, is a draft until they submit it.
function review(
  status: string | undefined,
  submitted: Submitted | undefined,
  text: Pick<NotificationText, "wording" | "buttons">
): TemplateReview {
  if (!status || status === "draft") return "draft"
  const { header, body, footer } = text.wording
  if (
    submitted &&
    JSON.stringify([submitted.header, submitted.body, submitted.footer, submitted.buttons]) !==
      JSON.stringify([header, body, footer, text.buttons])
  ) {
    return "draft"
  }
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
    // Every business sends from its own number today; Koblip's number is K3.
    editable: true,
    texts: Object.fromEntries(
      TEMPLATE_LANGUAGES.map((language): [TemplateLanguage, NotificationText] => {
        const mine = own.find((row) => row.message === message && row.language === language)
        const template = made.find((row) => row.message === message && row.language === language)
        const text = {
          wording: mine
            ? { header: mine.header, body: mine.body, footer: mine.footer }
            : defaultWording(message, language),
          buttons: mine?.buttons ?? defaultButtons(message, language),
        }
        const state = review(template?.status, template?.submitted, text)
        return [
          language,
          {
            ...text,
            isDefault: !mine,
            review: state,
            reason: state === "rejected" ? template?.reason ?? null : null,
          },
        ]
      })
    ) as NotificationMessage["texts"],
  }))
}

// A LIKE pattern that finds `text` anywhere, with LIKE's own wildcards
// taken literally.
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

// Search by customer name (any case) or phone (its digits, so "+1 555" finds
// 15550100000; each booking keeps the digits in customer_key as "p:<digits>").
function searchCondition(search: string): SQL | undefined {
  const text = search.trim()
  if (!text) return undefined
  const byName = sql`${bookings.customerName} like ${contains(text)} escape '\\'`
  const digits = text.replace(/\D/g, "")
  if (!digits) return byName
  return or(byName, sql`${bookings.customerKey} like ${`p:${contains(digits)}`} escape '\\'`)
}

// The latest messages, newest first: what is waiting, sent, or was not sent
// and why; narrowed by message, state and a search.
export async function notificationHistoryFor(
  businessId: string,
  filter: ActivityFilter = {}
): Promise<NotificationSend[]> {
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
      via: notificationSends.via,
      sender: notificationSends.sender,
      replyAction: notificationSends.replyAction,
      repliedAt: notificationSends.repliedAt,
    })
    .from(notificationSends)
    .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
    .where(
      and(
        eq(notificationSends.businessId, businessId),
        filter.message ? eq(notificationSends.message, filter.message) : undefined,
        filter.state ? eq(notificationSends.state, filter.state) : undefined,
        filter.search ? searchCondition(filter.search) : undefined
      )
    )
    .orderBy(desc(notificationSends.dueAt))
    .limit(NOTIFICATION_RULES.historySize)
  return rows.map(({ dueAt, sentAt, replyAction, repliedAt, ...row }) => ({
    ...row,
    at: sentAt ?? dueAt,
    reply: replyAction && repliedAt ? { action: replyAction, at: repliedAt } : null,
  }))
}
