"use server"

import { and, eq } from "drizzle-orm"

import { PHONE_PATTERN } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { notificationSettings, notificationTexts } from "@/lib/db/schema"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import type { ActionResult } from "../types"
import type { NotificationSettings } from "../types/notifications"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  wordingProblem,
  type BookingMessage,
  type TemplateLanguage,
  type Wording,
} from "../utils/booking-templates"
import { ChatApiError } from "./chat-oauth"
import { pushChatWording } from "./chat-templates"
import { notificationSettingsFor } from "./notifications"
import { ownedBusiness } from "./owned-business"

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

async function saveSettings(businessId: string, next: NotificationSettings) {
  const row = {
    ownerPhone: next.ownerPhone,
    ownerLanguage: next.ownerLanguage,
    reminders: next.reminders,
    quietStart: next.quietStart,
    quietEnd: next.quietEnd,
    turnedOff: next.turnedOff,
    freeTextInWindow: next.freeTextInWindow,
    cantCome: next.cantCome,
    thankYouReply: next.thankYouReply,
  }
  await db
    .insert(notificationSettings)
    .values({ businessId, ...row })
    .onConflictDoUpdate({ target: notificationSettings.businessId, set: row })
}

// A message's switch on the WhatsApp page.
export async function setMessageOn(
  businessId: string,
  message: BookingMessage,
  on: boolean
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (!BOOKING_MESSAGES.includes(message) || typeof on !== "boolean") {
    return { ok: false, error: "invalid" }
  }
  const current = await notificationSettingsFor(owned.business.id)
  const turnedOff = current.turnedOff.filter((item) => item !== message)
  await saveSettings(owned.business.id, {
    ...current,
    turnedOff: on ? turnedOff : [...turnedOff, message],
  })
  return { ok: true }
}

// Reminders, quiet hours and the owner's number, saved together.
export async function saveNotificationSettings(
  businessId: string,
  input: Pick<
    NotificationSettings,
    "ownerPhone" | "ownerLanguage" | "reminders" | "quietStart" | "quietEnd"
  >
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const phone = typeof input.ownerPhone === "string" ? input.ownerPhone.trim() : ""
  const reminders = Array.isArray(input.reminders) ? [...new Set(input.reminders)] : null
  if (
    (phone && !PHONE_PATTERN.test(phone)) ||
    !reminders ||
    reminders.length > NOTIFICATION_RULES.maxReminders ||
    reminders.some((minutes) => !(NOTIFICATION_RULES.reminderChoices as readonly number[]).includes(minutes)) ||
    !TIME_PATTERN.test(input.quietStart) ||
    !TIME_PATTERN.test(input.quietEnd)
  ) {
    return { ok: false, error: "invalid" }
  }
  const current = await notificationSettingsFor(owned.business.id)
  await saveSettings(owned.business.id, {
    ...current,
    ownerPhone: phone || null,
    ownerLanguage: input.ownerLanguage === "es" ? "es" : "en",
    reminders: reminders.sort((a, b) => b - a),
    quietStart: input.quietStart,
    quietEnd: input.quietEnd,
  })
  return { ok: true }
}

function where(businessId: string, message: BookingMessage, language: TemplateLanguage) {
  return and(
    eq(notificationTexts.businessId, businessId),
    eq(notificationTexts.message, message),
    eq(notificationTexts.language, language)
  )
}

// Saves a message's wording, or Book's default when `wording` is null, and
// sends it to Chat for Meta to review again. If Chat refuses (Meta limits how
// often an approved template may change), the wording before stays.
export async function saveMessageWording(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage,
  wording: Wording | null
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (!BOOKING_MESSAGES.includes(message) || !TEMPLATE_LANGUAGES.includes(language)) {
    return { ok: false, error: "invalid" }
  }
  const id = owned.business.id
  let next: Wording | null = null
  if (wording) {
    next = {
      header: String(wording.header ?? "").trim(),
      body: String(wording.body ?? "").trim(),
      footer: String(wording.footer ?? "").trim(),
    }
    const problem = wordingProblem(message, next)
    if (problem) return { ok: false, error: problem }
  }

  const [before] = await db.select().from(notificationTexts).where(where(id, message, language)).limit(1)
  const write = async (value: Wording | null) => {
    if (!value) return db.delete(notificationTexts).where(where(id, message, language))
    return db
      .insert(notificationTexts)
      .values({ businessId: id, message, language, ...value })
      .onConflictDoUpdate({
        target: [notificationTexts.businessId, notificationTexts.message, notificationTexts.language],
        set: value,
      })
  }
  await write(next)
  try {
    await pushChatWording(id, message, language)
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    console.error(error)
    await write(before ? { header: before.header, body: before.body, footer: before.footer } : null)
    return { ok: false, error: "chat" }
  }
  return { ok: true }
}
