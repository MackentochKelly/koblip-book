// Stream contract for POST /api/assistant (section 5 of docs/assistant-plan.md).
// One JSON object per line.
// Which owner page a confirmed change belongs to, for the result link.
export type ResultKind =
  "bookings" | "services" | "team" | "hours" | "customers" | "settings"
export type SourceKind = "bookings" | "services" | "team" | "customers"
export type AssistantStreamEvent =
  | { type: "text"; delta: string } // words appearing in the reply
  | { type: "result"; ok: boolean; text: string; kind: ResultKind } // tap outcome with a link
  | { type: "notice"; kind: "unverified" } // warning instead of words
  | { type: "sources"; items: { kind: SourceKind; count: number }[] } // what the answer was based on
  | {
      type: "step"
      id: string
      label: string
      status: "running" | "done" | "failed"
    } // small chip, e.g. "Finding bookings…"
  | {
      type: "confirm"
      id: string
      title: string
      summary: string
      destructive: boolean
      action: string // the button's word, e.g. "Book", "Delete"
    } // card with the action button and Cancel
  | { type: "choices"; options: string[] } // quick answers; a tap sends one
  | { type: "done" } // input enabled again
  | {
      type: "error"
      code:
        | "rate_limited"
        | "unavailable"
        | "too_long"
        | "not_allowed"
        | "expired"
        | "empty_audio"
        | "bad_request"
    } // short message and Retry; expired = confirm card too old or unknown.
// empty_audio = nothing heard; bad_request = malformed transcribe upload.
// The screen's words for these live in features/assistant/i18n (UI-owned).

export interface AssistantMessage {
  role: "owner" | "assistant"
  text: string
}

// One row of the Recent list: id, title, and last-write time.
export interface AssistantChatSummary {
  id: string
  title: string
  updatedAt: string // ISO date
}

// A saved chat: id, title, and the full word list.
export interface AssistantChat {
  id: string
  title: string
  messages: AssistantMessage[]
}

// Request for POST /api/assistant.
export interface AssistantRequest {
  businessId: string
  messages: AssistantMessage[]
  voice?: boolean // talking mode: short spoken answers
}

// Request for POST /api/assistant/confirm (tap on a confirm card).
export interface AssistantConfirmRequest {
  businessId: string
  id: string
  accept: boolean
}

// One tool the route handler offers to the loop.
export interface AssistantToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema for the arguments
  needsConfirm: boolean // true = sends a confirm event instead of running
  resultKind?: ResultKind // set on needsConfirm tools: the result link
}

// One tool the loop can run: definition sent to the model, label for the
// step chip, and a run function closed over the checked businessId.
export interface AssistantTool {
  definition: AssistantToolDefinition
  label: string
  run: (args: unknown) => Promise<unknown>
  // Present when definition.needsConfirm is true. The loop never calls
  // run for these: describe builds the card from database data, execute
  // runs the stored args after the owner's tap.
  confirm?: {
    describe: (args: unknown) => Promise<ConfirmCard | { error: string }>
    execute: (args: unknown) => Promise<{ ok: boolean; doneText: string }>
  }
}

// Card text for a pending risky action, built on the server from
// database data, never from model words.
export interface ConfirmCard {
  title: string
  summary: string
  destructive: boolean
  action: string // the button's word, e.g. "Book", "Delete"
}
