"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import {
  NOTIFICATION_RULES,
  type NotificationRuleKey,
} from "@/lib/notification-rules"
import { RuleValueError, setNotificationRule } from "@/lib/platform-settings"

export type RuleActionResult =
  { ok: true } | { ok: false; error: "invalid" | "failed" }

// WhatsApp → Rules (A7): saves the admin's value for one rule for everyone,
// or goes back to the default with null. lib/platform-settings.ts checks the
// value and logs the change.
export async function saveWhatsappRule(
  key: NotificationRuleKey,
  value: unknown
): Promise<RuleActionResult> {
  const session = await requireAdmin()
  if (typeof key !== "string" || !Object.hasOwn(NOTIFICATION_RULES, key)) {
    return { ok: false, error: "invalid" }
  }
  try {
    await setNotificationRule({ key, value, userId: session.userId })
  } catch (error) {
    if (error instanceof RuleValueError) return { ok: false, error: "invalid" }
    console.error(error)
    return { ok: false, error: "failed" }
  }
  revalidatePath("/admin/whatsapp/rules")
  revalidatePath("/admin/whatsapp/changes")
  return { ok: true }
}
