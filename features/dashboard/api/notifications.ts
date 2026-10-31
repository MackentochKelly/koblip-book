import "server-only"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  chatConnections,
  chatTemplates,
  koblipChatTemplates,
  notificationSettings,
  notificationTexts,
} from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import { whatsappActivity } from "@/lib/whatsapp-activity"
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
import { chatConnectionUsable } from "./chat-oauth"

// The business's WhatsApp notification settings, or the defaults as the
// admin set them (lib/platform-settings.ts).
export async function notificationSettingsFor(businessId: string): Promise<NotificationSettings> {
  const [[row], rules] = await Promise.all([
    db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.businessId, businessId))
      .limit(1),
    notificationRules(businessId),
  ])
  return {
    ownerPhone: row?.ownerPhone ?? null,
    ownerLanguage: row?.ownerLanguage ?? "en",
    reminders: row?.reminders ?? [...rules.defaultReminders],
    quietStart: row?.quietStart ?? rules.defaultQuietStart,
    quietEnd: row?.quietEnd ?? rules.defaultQuietEnd,
    turnedOff: row?.turnedOff ?? [],
    freeTextInWindow: row?.freeTextInWindow ?? rules.defaultFreeTextInWindow,
    cantCome: row?.cantCome ?? rules.defaultCantCome,
    thankYouReply: row?.thankYouReply ?? rules.defaultThankYouReply,
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
// Book's) and Meta's review. Without a working Koblip Chat workspace of its
// own the business sends Koblip's ready-made set, Book's wording, which only
// turns on or off (K4, D26), and Meta's review is that of Koblip's set (D36).
export async function notificationMessagesFor(businessId: string): Promise<NotificationMessage[]> {
  const [settings, texts, made, koblipMade, [connection]] = await Promise.all([
    notificationSettingsFor(businessId),
    db.select().from(notificationTexts).where(eq(notificationTexts.businessId, businessId)),
    db.select().from(chatTemplates).where(eq(chatTemplates.businessId, businessId)),
    db.select().from(koblipChatTemplates),
    db
      .select({ needsReconnect: chatConnections.needsReconnect, scopes: chatConnections.scopes })
      .from(chatConnections)
      .where(eq(chatConnections.businessId, businessId))
      .limit(1),
  ])
  const editable = !!connection && chatConnectionUsable(connection)
  const own = editable ? texts : []
  const templates = editable ? made : koblipMade
  return BOOKING_MESSAGES.map((message) => ({
    message,
    on: !settings.turnedOff.includes(message),
    editable,
    texts: Object.fromEntries(
      TEMPLATE_LANGUAGES.map((language): [TemplateLanguage, NotificationText] => {
        const mine = own.find((row) => row.message === message && row.language === language)
        const template = templates.find((row) => row.message === message && row.language === language)
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

// The latest messages of one business, newest first, for its Activity
// (lib/whatsapp-activity.ts, shared with the admin).
export async function notificationHistoryFor(
  businessId: string,
  filter: ActivityFilter = {}
): Promise<NotificationSend[]> {
  return whatsappActivity(filter, {
    businessId,
    limit: (await notificationRules(businessId)).historySize,
  })
}
