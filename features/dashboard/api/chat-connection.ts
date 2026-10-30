"use server"

import type { ChatMessagesState } from "../types/chat-connection"
import { endChatConnection } from "./chat-oauth"
import { chatConnectionFor, setUpChatTemplates } from "./chat-templates"
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

// Opening Integrations while connected: makes any missing booking templates in
// Koblip Chat and reads Meta's review, then says where they stand.
export async function refreshChatMessages(
  businessId: string
): Promise<ChatMessagesState | null> {
  await getOwnerBusiness(businessId)
  await setUpChatTemplates(businessId)
  return (await chatConnectionFor(businessId))?.messages ?? null
}
