// The owner's Koblip Chat connection, as the Integrations screen sees it:
// only the end of the key, never the key (docs/koblip-chat-integration.md).
export type ChatConnection = { last4: string }

export type ConnectChatInput = { apiKey: string; workspaceId: string }

export type ConnectChatFailure =
  | "invalid_key"
  | "wrong_workspace"
  | "no_permission"
  | "unreachable"

export type ConnectChatResult =
  | { ok: true; connection: ChatConnection }
  | { ok: false; reason: ConnectChatFailure }
