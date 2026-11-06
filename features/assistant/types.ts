import type { createTranslator, Messages } from "next-intl"

import type { PageLanguage } from "@/lib/page-language"
import type { MemoryRow } from "./utils/memory"

// The lines the server writes for the owner (i18n/server-en.ts), and the
// owner area's own names the tools read, as next-intl gives them
// (getTranslations).
export type ServerWords = ReturnType<
  typeof createTranslator<Messages, "assistantServer">
>
export type OwnerWords = ReturnType<typeof createTranslator<Messages, "owner">>

// Stream contract for POST /api/assistant (section 5 of docs/assistant-plan.md).
// One JSON object per line.
// Which owner page a confirmed change belongs to, for the result link.
export type ResultKind =
  | "bookings"
  | "services"
  | "team"
  | "hours"
  | "customers"
  | "settings"
  | "photos"
  | "policies"
  | "theme"
  | "messages"
  | "timing"
  | "flows"
export type SourceKind = "bookings" | "services" | "team" | "customers"
export type AssistantStreamEvent =
  | { type: "text"; delta: string } // words appearing in the reply
  | { type: "result"; ok: boolean; text: string; kind: ResultKind } // tap outcome with a link
  | { type: "sources"; items: { kind: SourceKind; count: number }[] } // what the answer was based on
  | {
      type: "step"
      id: string
      label: string
      status: "running" | "done" | "failed"
      line?: string // talking: the AI's own words said while a lookup runs
    } // small chip, e.g. "Finding bookings…"
  | {
      type: "confirm"
      id: string
      title: string
      summary: string
      destructive: boolean
      action: string // the button's word, e.g. "Book", "Delete"
    } // card with the action button and Cancel
  | { type: "accepted"; id: string } // an earlier card the owner said yes to in words; its result follows
  | { type: "declined"; id: string } // an earlier card the owner said no to in words; nothing changed
  | { type: "memory"; rows: MemoryRow[] } // records this answer looked up, sent back with it next time
  | { type: "choices"; options: string[] } // quick answers; a tap sends one
  | {
      type: "times"
      service: string
      teamMember: string | null
      today: string // "YYYY-MM-DD" in the business timezone
      days: { date: string; times: string[] }[]
    } // a day and time picker; a tap sends the picked time
  | { type: "done" } // input enabled again
  | {
      type: "error"
      code:
        | "rate_limited"
        | "unavailable"
        | "too_long"
        | "not_allowed"
        | "expired"
        | "bad_request"
    } // short message and Retry; expired = confirm card too old or unknown.
// bad_request = malformed live voice audio.
// The screen's words for these live in features/assistant/i18n (UI-owned).

export interface AssistantMessage {
  role: "owner" | "assistant"
  text: string
  // Assistant only. The owner cut this reply off; `text` is only the part they saw or heard.
  interrupted?: boolean
  // Assistant only. The records this reply looked up (the `memory` event).
  memory?: MemoryRow[]
  // Assistant only. The id of this reply's card that still waits for the
  // owner's tap, so the next answer knows about it.
  waiting?: string
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

export type CardAnswer = "yes" | "no"

// Request for POST /api/assistant.
export interface AssistantRequest {
  businessId: string
  messages: AssistantMessage[]
  voice?: boolean // talking mode: short spoken answers
  // Talking mode, right after a tap on a card's yes or no button: nothing new
  // was said, so the answer says what the tap did (the last message) and
  // carries on with what is left.
  afterTap?: CardAnswer
}

// What the assistant says while it works in one talk, written by the AI when
// the talk starts, in the owner's language.
export interface VoiceLines {
  cutIns: string[] // said before an answer that cuts a waiting line off; each once at most
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
  label: string // while it runs
  doneLabel: string // once it ran well
  run: (args: unknown) => Promise<unknown>
  // Present when definition.needsConfirm is true. The loop never calls
  // run for these: describe builds the card from database data, execute
  // runs the stored args after the owner's tap.
  confirm?: {
    describe: (args: unknown) => Promise<DescribedConfirm | { error: string }>
    execute: (args: unknown) => Promise<{ ok: boolean; doneText: string }>
    // Said when the owner taps the card's other button; the plain
    // "nothing was changed" line otherwise.
    declinedText?: string
  }
}

// describe's answer: the card, and the exact args the tap runs when the
// model's own words would need looking up again (names, "today"). Stored
// in place of the model's args, so the tap does what the card shows.
export interface DescribedConfirm extends ConfirmCard {
  args?: unknown
}

// Card text for a pending risky action, built on the server from
// database data, never from model words.
export interface ConfirmCard {
  title: string
  summary: string
  destructive: boolean
  action: string // the button's word, e.g. "Book", "Delete"
}

// Hears an answer while it is written (talking mode): its words, and the
// moment a lookup starts, with the AI's own line for it if it wrote one.
export interface AnswerListener {
  onText: (delta: string) => void
  onLookup: (line?: string) => void
  // The answer's check, run after it ended, could not back it.
}

// One voice the owner can pick for talking live (an account voice, see
// lib/account-voices.ts), and the one they chose (null: none yet).
export interface VoiceOption {
  voiceId: string
  name: string
  labels: Record<string, string>
  // The voice speaking each page language it speaks.
  previews: Partial<Record<PageLanguage, string>>
}
export interface VoiceChoice {
  // Null when ElevenLabs could not be reached.
  voices: VoiceOption[] | null
  chosen: string | null
}
