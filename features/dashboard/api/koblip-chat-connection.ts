"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { chatConnections } from "@/lib/db/schema"
import { adminChangeEntry } from "@/lib/platform-settings"
import { endChatConnection, endKoblipChatConnection } from "./chat-oauth"

// The admin area's Chat connection actions; its pages pass them in, since
// they live with the Chat connection code.

// Disconnect in the admin area: ends Koblip's own connection at Koblip Chat
// and forgets its tokens here (K1). Businesses without their own number stop
// sending until an admin connects it again.
export async function disconnectKoblipChat(): Promise<{ ok: true }> {
  await requireAdmin()
  await endKoblipChatConnection()
  return { ok: true }
}

// An admin disconnects one business's own workspace (A4), as its owner can
// on Integrations; the change is logged. The business then sends from
// Koblip's number.
export async function disconnectBusinessChat(businessId: string): Promise<{ ok: boolean }> {
  const session = await requireAdmin()
  if (typeof businessId !== "string") return { ok: false }
  const [row] = await db
    .select({ workspaceName: chatConnections.workspaceName })
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (row) {
    await endChatConnection(businessId)
    await adminChangeEntry({
      key: "whatsapp.connection",
      businessId,
      before: row.workspaceName,
      after: null,
      userId: session.userId,
    })
  }
  revalidatePath(`/admin/whatsapp/businesses/${businessId}`)
  revalidatePath("/admin/whatsapp/businesses")
  return { ok: true }
}
