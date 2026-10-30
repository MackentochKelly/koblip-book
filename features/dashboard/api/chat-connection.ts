"use server"

import { endChatConnection } from "./chat-oauth"
import { getOwnerBusiness } from "./queries"

// Disconnect on the Integrations page: ends the connection at Koblip Chat and
// forgets its tokens here.
export async function disconnectChat(
  businessId: string
): Promise<{ ok: true }> {
  await getOwnerBusiness(businessId)
  await endChatConnection(businessId)
  return { ok: true }
}
