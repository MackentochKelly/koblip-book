import type {
  AssistantChat,
  AssistantChatSummary,
  AssistantMessage,
} from "../types"

// The owner's saved chats on the server (GET/PUT /api/assistant/chats).
// Each call returns null when the server could not answer.

const base = "/api/assistant/chats"

export async function listChats(
  businessId: string
): Promise<AssistantChatSummary[] | null> {
  try {
    const response = await fetch(
      `${base}?businessId=${encodeURIComponent(businessId)}`
    )
    return response.ok
      ? ((await response.json()) as AssistantChatSummary[])
      : null
  } catch {
    return null
  }
}

export async function getChat(
  businessId: string,
  id: string
): Promise<AssistantChat | null> {
  try {
    const response = await fetch(
      `${base}/${id}?businessId=${encodeURIComponent(businessId)}`
    )
    return response.ok ? ((await response.json()) as AssistantChat) : null
  } catch {
    return null
  }
}

// Creates the chat or replaces its words. True when it was saved.
export async function putChat(
  businessId: string,
  id: string,
  messages: AssistantMessage[]
): Promise<boolean> {
  try {
    const response = await fetch(`${base}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, messages }),
    })
    return response.ok
  } catch {
    return false
  }
}
