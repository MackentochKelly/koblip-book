"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { emailBlocks } from "@/lib/db/schema"
import { adminChangeEntry } from "@/lib/platform-settings"
import type { AdminActionResult } from "./actions"

// Email → Blocked: lets an address get email again (a typo fixed, a
// "Stop emails" taken back). Saved with its entry in the change log,
// together. Amazon's own suppression list may still hold a bounced address.
export async function removeEmailBlock(id: string): Promise<AdminActionResult> {
  const session = await requireAdmin()
  if (typeof id !== "string") return { ok: false }
  const [row] = await db.select().from(emailBlocks).where(eq(emailBlocks.id, id)).limit(1)
  if (row) {
    await saveAll([
      db.delete(emailBlocks).where(eq(emailBlocks.id, id)),
      adminChangeEntry({
        key: "email.block.remove",
        businessId: row.businessId,
        before: { email: row.email, reason: row.reason },
        after: null,
        userId: session.userId,
      }),
    ])
  }
  revalidatePath("/admin/email/blocked")
  return { ok: true }
}
