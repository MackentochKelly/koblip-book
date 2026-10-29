import type {
  AssistantMessage,
  AssistantStreamEvent,
  ResultKind,
  SourceKind,
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

// What an answer was based on: records looked up, by kind.
export interface ChatSource {
  kind: SourceKind
  count: number
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
      sources: ChatSource[]
      // Set when the answer could not be double-checked.
      unverified: boolean
      // Set when the owner cut it off: the part they saw or heard.
      cutOff?: string
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

// The owner cut off the reply being written or spoken. `heard` is what
// talking mode played of it; typed, it is what was on screen. The first
// mark wins: a stop that follows a talk-over keeps what was heard. Talking
// over the last words of a reply heard in full is not a cut-off, like
// OpenAI's truncation, which removes only audio that never played.
export function markCutOff(items: ChatItem[], heard?: string): ChatItem[] {
  const last = items.at(-1)
  if (last?.role !== "assistant" || last.cutOff !== undefined) return items
  if (heard !== undefined && letters(heard).length >= letters(last.text).length)
    return items
  return [...items.slice(0, -1), { ...last, cutOff: heard ?? last.text }]
}

// Letters and digits only, so spoken words compare with written Markdown.
const letters = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")

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
    sources: [],
    unverified: false,
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
    case "sources":
      return withReply(items, (reply) => ({ ...reply, sources: event.items }))
    case "notice":
      return withReply(items, (reply) => ({ ...reply, unverified: true }))
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

// A saved chat's words back as items: replies come back as plain words,
// without their steps, cards or buttons.
export function fromMessages(messages: AssistantMessage[]): ChatItem[] {
  return messages.map((message) =>
    message.role === "owner"
      ? { id: crypto.randomUUID(), role: "owner", text: message.text }
      : { ...(newReply() as AssistantItem), text: message.text }
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

// What the server gets: the words only, the newest `limit` messages. A
// cut-off reply goes as only the part the owner got, marked, so the next
// answer covers the rest; one cut off before any words is left out.
export function toMessages(
  items: ChatItem[],
  limit: number
): AssistantMessage[] {
  return items
    .map((item): AssistantMessage =>
      item.role === "assistant" && item.cutOff !== undefined
        ? { role: item.role, text: item.cutOff, interrupted: true }
        : { role: item.role, text: wordsOf(item) }
    )
    .filter((message) => message.text.trim() !== "")
    .slice(-limit)
}

// Saved chats carry this number. Raise it whenever ChatItem changes:
// a chat saved by another version starts fresh instead of breaking the
// screen.
export const CHAT_STORAGE_VERSION = 5

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
    (item.cutOff === undefined || isText(item.cutOff)) &&
    Array.isArray(item.sources) &&
    typeof item.unverified === "boolean" &&
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
