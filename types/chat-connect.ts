// The Koblip Chat connect window, shared by the places that open it: a
// business's Integrations page and the admin area (Koblip's own connection).

// How the Chat window ended: the person allowed, cancelled, or it failed.
export type ChatConnectResult = "connected" | "denied" | "failed"

export const CHAT_CONNECT_RESULTS: readonly ChatConnectResult[] = [
  "connected",
  "denied",
  "failed",
]

// The Chat window tells the page that opened it how it ended on this channel
// (same site only), then closes.
export const CHAT_CONNECT_CHANNEL = "koblip-chat-connect"

// What the window posts: which connection it was for, and how it ended.
export type ChatConnectMessage = {
  // Empty for Koblip's own connection.
  businessId: string
  koblip: boolean
  result: ChatConnectResult
}
