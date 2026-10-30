// Where the business's WhatsApp booking messages stand: no WhatsApp number in
// the Chat workspace, templates being made, waiting for Meta's review,
// approved, or one was rejected.
export type ChatMessagesState = "noNumber" | "settingUp" | "waiting" | "ready" | "rejected"

// The business's Koblip Chat connection, as the Integrations screen sees it:
// the workspace's name, whether to connect again and where its messages
// stand, never a token (docs/koblip-chat-integration.md).
export type ChatConnection = {
  workspaceName: string
  needsReconnect: boolean
  messages: ChatMessagesState
}

// How the Chat window ended: the owner allowed, cancelled, or it failed.
export type ChatConnectResult = "connected" | "denied" | "failed"

export const CHAT_CONNECT_RESULTS: readonly ChatConnectResult[] = [
  "connected",
  "denied",
  "failed",
]

// The Chat window tells the Integrations page how it ended on this channel
// (same site only), then closes.
export const CHAT_CONNECT_CHANNEL = "koblip-chat-connect"
