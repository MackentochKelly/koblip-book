"use server"

import { requireAdmin } from "@/lib/dal"
import { endKoblipChatConnection } from "./chat-oauth"

// Disconnect in the admin area: ends Koblip's own connection at Koblip Chat
// and forgets its tokens here (K1). Businesses without their own number stop
// sending until an admin connects it again.
export async function disconnectKoblipChat(): Promise<{ ok: true }> {
  await requireAdmin()
  await endKoblipChatConnection()
  return { ok: true }
}
