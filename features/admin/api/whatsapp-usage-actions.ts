"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { RuleValueError, setNotificationRule } from "@/lib/platform-settings"
import type { RuleActionResult } from "./whatsapp-rule-actions"

// WhatsApp → Usage (A8): Koblip's monthly limit of template messages, for
// everyone (no business) or one business; null goes back to the default, or
// to everyone's. lib/platform-settings.ts checks the value and logs it.
export async function saveKoblipLimit(
  businessId: string | null,
  value: number | null
): Promise<RuleActionResult> {
  const session = await requireAdmin()
  if (businessId !== null) {
    if (typeof businessId !== "string") return { ok: false, error: "invalid" }
    const [row] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1)
    if (!row) return { ok: false, error: "invalid" }
  }
  try {
    await setNotificationRule({
      key: "koblipMonthlyTemplates",
      value,
      userId: session.userId,
      businessId: businessId ?? undefined,
    })
  } catch (error) {
    if (error instanceof RuleValueError) return { ok: false, error: "invalid" }
    console.error(error)
    return { ok: false, error: "failed" }
  }
  revalidatePath("/admin/whatsapp/usage")
  revalidatePath("/admin/whatsapp/rules")
  revalidatePath("/admin/whatsapp/changes")
  return { ok: true }
}
