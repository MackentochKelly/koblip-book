"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/dal"
import type { KoblipSubmitResult } from "@/types/koblip-messages"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
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
    return { ok: false, error: "chat" }
  }
  revalidatePath("/admin/whatsapp/koblip-messages")
  return { ok: true }
}
