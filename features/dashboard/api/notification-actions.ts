"use server"

import { and, eq } from "drizzle-orm"

import { PHONE_PATTERN } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { notificationSends, notificationSettings, notificationTexts } from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import { sendAgainWrite } from "@/lib/whatsapp-sends"
import type { ActionResult } from "../types"
import type { CantComeAction, MessageButton, NotificationSettings } from "../types/notifications"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  buttonsProblem,
  wordingProblem,
  type BookingMessage,
  type TemplateLanguage,
  type Wording,
} from "../utils/booking-templates"
import { ChatApiError } from "./chat-oauth"
import { submitChatTemplate } from "./chat-templates"
import { sendTestMessage } from "./notification-sender"
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

const CANT_COME_ACTIONS: readonly CantComeAction[] = ["cancel", "alertOnly"]

// Reminders, quiet hours and the owner's number, saved together; the 24-hour
// setting, what "Can't make it" does and the thank-you reply when given
// (left as they are when not).
export async function saveNotificationSettings(
  businessId: string,
  input: Pick<
    NotificationSettings,
    "ownerPhone" | "ownerLanguage" | "reminders" | "quietStart" | "quietEnd"
  > &
    Partial<Pick<NotificationSettings, "freeTextInWindow" | "cantCome" | "thankYouReply">>
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const rules = await notificationRules(owned.business.id)
  const phone = typeof input.ownerPhone === "string" ? input.ownerPhone.trim() : ""
  const reminders = Array.isArray(input.reminders) ? [...new Set(input.reminders)] : null
  const flag = (value: unknown) => value === undefined || typeof value === "boolean"
  if (
    (phone && !PHONE_PATTERN.test(phone)) ||
    !reminders ||
    reminders.length > rules.maxReminders ||
    reminders.some((minutes) => !rules.reminderChoices.includes(minutes)) ||
    !TIME_PATTERN.test(input.quietStart) ||
    !TIME_PATTERN.test(input.quietEnd) ||
    !flag(input.freeTextInWindow) ||
    !flag(input.thankYouReply) ||
    (input.cantCome !== undefined && !CANT_COME_ACTIONS.includes(input.cantCome))
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
    freeTextInWindow: input.freeTextInWindow ?? current.freeTextInWindow,
    cantCome: input.cantCome ?? current.cantCome,
    thankYouReply: input.thankYouReply ?? current.thankYouReply,
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

// Saves a message's wording and buttons in Book, or Book's own when `wording`
// is null; `buttons` null keeps Book's default buttons. Nothing goes to Meta
// until the owner submits it (submitMessageToMeta).
export async function saveMessageWording(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage,
  wording: Wording | null,
  buttons: MessageButton[] | null = null
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (!BOOKING_MESSAGES.includes(message) || !TEMPLATE_LANGUAGES.includes(language)) {
    return { ok: false, error: "invalid" }
  }
  const id = owned.business.id
  if (!wording) {
    await db.delete(notificationTexts).where(where(id, message, language))
    return { ok: true }
  }
  const next = {
    header: String(wording.header ?? "").trim(),
    body: String(wording.body ?? "").trim(),
    footer: String(wording.footer ?? "").trim(),
    buttons: Array.isArray(buttons)
      ? buttons.map((button) => ({ action: button?.action, label: String(button?.label ?? "").trim() }))
      : null,
  }
  const problem =
    wordingProblem(message, next) ?? (next.buttons && buttonsProblem(message, next.buttons))
  if (problem) return { ok: false, error: problem }
  await db
    .insert(notificationTexts)
    .values({ businessId: id, message, language, ...next })
    .onConflictDoUpdate({
      target: [notificationTexts.businessId, notificationTexts.message, notificationTexts.language],
      set: next,
    })
  return { ok: true }
}

// "Submit to Meta" for one message in one language: its saved wording and
// buttons go to Meta for review through Chat. When Chat or Meta refuses at
// once, `reason` carries their words for the owner.
export async function submitMessageToMeta(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage
): Promise<ActionResult | { ok: false; error: "refused"; reason: string }> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (!BOOKING_MESSAGES.includes(message) || !TEMPLATE_LANGUAGES.includes(language)) {
    return { ok: false, error: "invalid" }
  }
  try {
    const problem = await submitChatTemplate(owned.business.id, message, language)
    return problem ? { ok: false, error: problem } : { ok: true }
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    console.error(error)
    return error.reason ? { ok: false, error: "refused", reason: error.reason } : { ok: false, error: "chat" }
  }
}

// "Send a test to my phone": one message with sample values to the owner's
// WhatsApp now. `error` says why it did not go (the same reasons as Activity).
export async function sendTestToMyPhone(
  businessId: string,
  message: BookingMessage
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (!BOOKING_MESSAGES.includes(message)) return { ok: false, error: "invalid" }
  const outcome = await sendTestMessage(owned.business.id, message)
  if (outcome.state === "sent") return { ok: true }
  return { ok: false, error: outcome.state === "pending" ? "chat" : outcome.reason }
}

// "Send again" on a failed message: the same message goes back to waiting
// and the next check sends it, once more. Not for a message whose booking is
// cancelled or already started.
export async function sendAgain(businessId: string, sendId: string): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const again = await sendAgainWrite(sendId, owned.business.id)
  if (!again.ok) return again
  const done = await again.write.returning({ id: notificationSends.id })
  return done.length ? { ok: true } : { ok: false, error: "notFailed" }
}
