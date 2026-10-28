import type {
  AssistantMessage,
  AssistantStreamEvent,
  ResultKind,
} from "../types"

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
  action: string
  state: ConfirmState
}

// What a tapped action did, and which owner page it changed.
export interface ChatResult {
  ok: boolean
  text: string
  kind: ResultKind
}

export type ChatItem =
  | { id: string; role: "owner"; text: string }
  | {
      id: string
      role: "assistant"
      text: string
      steps: ChatStep[]
      confirms: ChatConfirm[]
      // Quick answers the owner can tap instead of typing.
      choices: string[]
      result: ChatResult | null
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
    choices: [],
    result: null,
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
            action: event.action,
            state: "pending",
          },
        ],
      }))
    case "choices":
      return withReply(items, (reply) => ({
        ...reply,
        choices: event.options,
      }))
    case "result":
      return withReply(items, (reply) => ({
        ...reply,
        result: { ok: event.ok, text: event.text, kind: event.kind },
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

// The words of one item; a tapped action's result counts as words, so
// the assistant knows on the next question what was done.
function wordsOf(item: ChatItem): string {
  if (item.role === "owner" || !item.result) return item.text
  return [item.text, item.result.text]
    .filter((part) => part.trim())
    .join("\n\n")
}

// What the server gets: the words only, the newest `limit` messages.
export function toMessages(
  items: ChatItem[],
  limit: number
): AssistantMessage[] {
  return items
    .map((item) => ({ role: item.role, text: wordsOf(item) }))
    .filter((message) => message.text.trim() !== "")
    .slice(-limit)
}

// Saved chats carry this number. Raise it whenever ChatItem changes:
// a chat saved by another version starts fresh instead of breaking the
// screen.
export const CHAT_STORAGE_VERSION = 4

const isText = (value: unknown): value is string => typeof value === "string"

// Only a reply that has every field this version draws.
function isChatItem(value: unknown): value is ChatItem {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  if (!isText(item.id) || !isText(item.text)) return false
  if (item.role === "owner") return true
  return (
    item.role === "assistant" &&
    Array.isArray(item.steps) &&
    Array.isArray(item.confirms) &&
    Array.isArray(item.choices) &&
    item.choices.every(isText) &&
    (item.result === null ||
      (typeof item.result === "object" &&
        isText((item.result as Record<string, unknown>).text) &&
        isText((item.result as Record<string, unknown>).kind)))
  )
}

export function saveChat(items: ChatItem[]): string {
  return JSON.stringify({ version: CHAT_STORAGE_VERSION, items })
}

// The saved chat, or nothing when it is missing, from another version
// or not the shape this version draws.
export function restoreChat(saved: string | null): ChatItem[] {
  if (!saved) return []
  try {
    const data: unknown = JSON.parse(saved)
    if (typeof data !== "object" || data === null) return []
    const { version, items } = data as { version?: unknown; items?: unknown }
    if (version !== CHAT_STORAGE_VERSION || !Array.isArray(items)) return []
    return items.every(isChatItem) ? items : []
  } catch {
    return []
  }
}
