"use server"

import type {
  ConnectChatInput,
  ConnectChatResult,
} from "../types/chat-connection"
import { getOwnerBusiness } from "./queries"

// Stand-in until the backend is built (docs/koblip-chat-integration.md,
// "Book server actions"): it accepts any key and saves nothing, so the
// screen can be built and tried first. The real actions check the key with
// Koblip Chat and store it encrypted.
export async function connectChat(
  businessId: string,
  input: ConnectChatInput
): Promise<ConnectChatResult> {
  await getOwnerBusiness(businessId)
  return { ok: true, connection: { last4: input.apiKey.trim().slice(-4) } }
}

export async function disconnectChat(
  businessId: string
): Promise<{ ok: true }> {
  await getOwnerBusiness(businessId)
  return { ok: true }
}
