"use server"

import "server-only"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { koblipNotificationTexts, platformSettingChanges } from "@/lib/db/schema"
import { runInTurn } from "@/lib/run-in-turn"
import type { MessageButton } from "../types/notifications"
import type { KoblipSaveResult, KoblipSubmitResult } from "@/types/koblip-messages"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  buttonsProblem,
  wordingProblem,
  type Wording,
  type BookingMessage,
  type TemplateLanguage,
} from "../utils/booking-templates"
import { ChatApiError } from "./chat-oauth"
import { submitKoblipTemplate } from "./chat-templates"

// "Submit to Meta" on the admin's Koblip messages (K2): one of Koblip's
// ready-made messages in one language goes to Meta from Koblip's workspace.
export async function submitKoblipMessage(
  message: BookingMessage,
  language: TemplateLanguage
): Promise<KoblipSubmitResult> {
  const { userId } = await requireAdmin()
  if (!BOOKING_MESSAGES.includes(message) || !TEMPLATE_LANGUAGES.includes(language)) {
    return { ok: false, error: "not_found" }
  }
  try {
    const problem = await submitKoblipTemplate(message, language, userId)
    if (problem) return { ok: false, error: problem }
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    console.error(error)
    return { ok: false, error: "chat", reason: error.reason ?? null }
  }
  revalidatePath("/admin/whatsapp/koblip-messages")
  return { ok: true }
}

// Saving affects normal messages immediately; only an explicit submit goes to Meta.
export async function saveKoblipMessage(
  message: BookingMessage,
  language: TemplateLanguage,
  wording: Wording | null,
  buttons: MessageButton[] | null
): Promise<KoblipSaveResult> {
  const { userId } = await requireAdmin()
  if (!BOOKING_MESSAGES.includes(message) || !TEMPLATE_LANGUAGES.includes(language)) {
    return { ok: false, error: "not_found" }
  }
  if (wording !== null && (typeof wording !== "object" || !wording)) {
    return { ok: false, error: "invalid" }
  }
  if (wording !== null && buttons !== null && !Array.isArray(buttons)) {
    return { ok: false, error: "invalid" }
  }
  const next = wording === null ? null : {
    header: String(wording.header ?? "").trim(),
    body: String(wording.body ?? "").trim(),
    footer: String(wording.footer ?? "").trim(),
    buttons: buttons === null ? null : buttons.map((button) => ({
      action: button?.action,
      label: String(button?.label ?? "").trim(),
    })),
  }
  const problem = next && (wordingProblem(message, next) ??
    (next.buttons && buttonsProblem(message, next.buttons)))
  if (problem) return { ok: false, error: problem }
  await runInTurn(`koblipWording:${message}:${language}`, async () => {
    const where = and(
      eq(koblipNotificationTexts.message, message),
      eq(koblipNotificationTexts.language, language)
    )
    const [before] = await db.select().from(koblipNotificationTexts).where(where)
    await saveAll([
      next ? db.insert(koblipNotificationTexts).values({ message, language, ...next })
        .onConflictDoUpdate({ target: [koblipNotificationTexts.message, koblipNotificationTexts.language], set: next })
        : db.delete(koblipNotificationTexts).where(where),
      db.insert(platformSettingChanges).values({
        key: `whatsapp.koblipWording.${message}.${language}`,
        before: before ? { header: before.header, body: before.body, footer: before.footer, buttons: before.buttons } : null,
        after: next,
        changedBy: userId,
      }),
    ])
  })
  revalidatePath("/admin/whatsapp/koblip-messages")
  return { ok: true }
}
