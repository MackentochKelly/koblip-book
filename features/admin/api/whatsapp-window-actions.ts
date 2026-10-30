"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { chatReplies } from "@/lib/db/schema"
import { adminChangeEntry } from "@/lib/platform-settings"
import type { AdminActionResult } from "./actions"

export type WindowEntryKey = {
  workspaceId: string
  phoneNumberId: string
  customerPhone: string
}

// Removes one entry of the 24-hour window (A6): until the customer writes
// again, messages to them from that number go as templates. Saved with its
// entry in the change log, together.
export async function removeWindowEntry(
  entry: WindowEntryKey
): Promise<AdminActionResult> {
  const session = await requireAdmin()
  const { workspaceId, phoneNumberId, customerPhone } = entry ?? {}
  if (
    typeof workspaceId !== "string" ||
    typeof phoneNumberId !== "string" ||
    typeof customerPhone !== "string"
  ) {
    return { ok: false }
  }
  const where = and(
    eq(chatReplies.workspaceId, workspaceId),
    eq(chatReplies.phoneNumberId, phoneNumberId),
    eq(chatReplies.customerPhone, customerPhone)
  )
  const [row] = await db.select().from(chatReplies).where(where).limit(1)
  if (row) {
    await saveAll([
      db.delete(chatReplies).where(where),
      adminChangeEntry({
        key: "whatsapp.window.remove",
        businessId: null,
        before: {
          workspaceId,
          phoneNumberId,
          customerPhone,
          lastReplyAt: row.lastReplyAt,
        },
        after: null,
        userId: session.userId,
      }),
    ])
  }
  revalidatePath("/admin/whatsapp/window")
  return { ok: true }
}
