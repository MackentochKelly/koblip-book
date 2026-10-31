import "server-only"

import { desc, eq } from "drizzle-orm"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { assistantPendingActions, businesses, user } from "@/lib/db/schema"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"

// Assistant (docs/plans/assistant-fixes.md, A8): every card waiting for an
// owner's tap, newest first. Nothing hidden.

export type AdminPendingAction = {
  id: string
  toolName: string
  businessName: string
  timezone: string
  ownerEmail: string
  at: string
  // False once it is too old to tap; removed on the next store.
  live: boolean
}

export async function getAdminPendingActions(): Promise<AdminPendingAction[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: assistantPendingActions.id,
      toolName: assistantPendingActions.toolName,
      businessName: businesses.name,
      timezone: businesses.timezone,
      ownerEmail: user.email,
      at: assistantPendingActions.createdAt,
    })
    .from(assistantPendingActions)
    .innerJoin(businesses, eq(businesses.id, assistantPendingActions.businessId))
    .innerJoin(user, eq(user.id, assistantPendingActions.ownerId))
    .orderBy(desc(assistantPendingActions.createdAt))
    .limit(WHATSAPP_ADMIN_RULES.listRows)
  const oldest = Date.now() - ASSISTANT_RULES.pendingActionExpiresMs
  return rows.map((row) => ({ ...row, live: Date.parse(row.at) > oldest }))
}
