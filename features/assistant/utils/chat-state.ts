import type { AssistantMessage, AssistantStreamEvent } from "../types"

export type ConfirmState = "pending" | "accepted" | "declined"

export interface ChatStep {
  id: string
  label: string
  status: "running" | "done" | "failed"
}

export interface ChatConfirm {
  id: string
  title: string
  summary: string
  destructive: boolean
  state: ConfirmState
}

export type ChatItem =
  | { id: string; role: "owner"; text: string }
  | {
      id: string
      role: "assistant"
      text: string
      steps: ChatStep[]
      confirms: ChatConfirm[]
    }

type AssistantItem = Extract<ChatItem, { role: "assistant" }>

// The reply being written is the last item; a new one starts after the
// owner's message.
function withReply(
  items: ChatItem[],
  change: (reply: AssistantItem) => AssistantItem
): ChatItem[] {
  const last = items.at(-1)
  if (last?.role === "assistant") {
    return [...items.slice(0, -1), change(last)]
  }
  return [...items, change(newReply() as AssistantItem)]
}

// An empty reply, so what comes next starts a new message.
export function newReply(): ChatItem {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: "",
    steps: [],
    confirms: [],
  }
}

export function applyEvent(
  items: ChatItem[],
  event: AssistantStreamEvent
): ChatItem[] {
  switch (event.type) {
    case "text":
      return withReply(items, (reply) => ({
        ...reply,
        text: reply.text + event.delta,
      }))
    case "step":
      return withReply(items, (reply) => {
        const step: ChatStep = {
          id: event.id,
          label: event.label,
          status: event.status,
        }
        const known = reply.steps.some((found) => found.id === event.id)
        return {
          ...reply,
          steps: known
            ? reply.steps.map((found) => (found.id === event.id ? step : found))
            : [...reply.steps, step],
        }
      })
    case "confirm":
      return withReply(items, (reply) => ({
        ...reply,
        confirms: [
          ...reply.confirms,
          {
            id: event.id,
            title: event.title,
            summary: event.summary,
            destructive: event.destructive,
            state: "pending",
          },
        ],
      }))
    default:
      return items
  }
}

export function resolveConfirm(
  items: ChatItem[],
  id: string,
  state: ConfirmState
): ChatItem[] {
  return items.map((item) =>
    item.role === "assistant"
      ? {
          ...item,
          confirms: item.confirms.map((confirm) =>
            confirm.id === id ? { ...confirm, state } : confirm
          ),
        }
      : item
  )
}

// What the server gets: the words only, the newest `limit` messages.
export function toMessages(
  items: ChatItem[],
  limit: number
): AssistantMessage[] {
  return items
    .filter((item) => item.text.trim() !== "")
    .map((item) => ({ role: item.role, text: item.text }))
    .slice(-limit)
}
