// Where the business's WhatsApp booking messages stand: no WhatsApp number in
// the Chat workspace, not known yet, some not submitted to Meta by the owner,
// waiting for Meta's review, approved, or one was rejected.
export type ChatMessagesState =
  | "noNumber"
  | "settingUp"
  | "notSubmitted"
  | "waiting"
  | "ready"
  | "rejected"

// The business's Koblip Chat connection, as the Integrations screen sees it:
// the workspace's name, whether to connect again and where its messages
// stand, never a token (docs/koblip-chat-integration.md).
export type ChatConnection = {
  workspaceName: string
  needsReconnect: boolean
  messages: ChatMessagesState
}
