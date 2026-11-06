import type { PageLanguage } from "@/lib/page-language"

export type AutomationTrigger = "firstMessage" // more later (D1)
// A flow's words are kept in every page language.
export type AutomationLanguage = PageLanguage

// What a button does. Each one is data, never a branch in the UI.
export type AutomationAction =
  | { type: "bookingLink" } // cta_url button to the booking page
  | { type: "servicesList" } // interactive list of services
  | { type: "handoff" } // tell the owner, pause automations (D5)

export type AutomationButton = {
  id: string // stable, used as the WhatsApp button payload
  label: Record<AutomationLanguage, string> // ≤ rules.maxButtonLabel
  action: AutomationAction
}

export type AutomationWording = Record<AutomationLanguage, {
  body: string // ≤ rules.maxBody; may use {business}
  // The reply for each action that sends words of its own.
  handoffReply: string
  servicesIntro: string
}>

export type Automation = {
  id: string
  trigger: AutomationTrigger
  on: boolean
  wording: AutomationWording
  buttons: AutomationButton[] // 1..rules.maxButtons (3)
  isDefault: boolean // Book's wording, nothing saved
  updatedAt: string
}

export type AutomationProblem =
  | "empty" | "tooLong" | "tooManyButtons" | "duplicateLabel"
  | "badField" | "noOwnNumber" | "not_found" | "invalid" | "locked"

export type AutomationSaveResult =
  | { ok: true }
  | { ok: false; error: AutomationProblem; field?: string }

export type AutomationRun = {
  id: string
  automationId: string
  customerPhone: string
  customerName: string | null
  step: "welcome" | "bookingLink" | "servicesList" | "serviceLink" | "handoff"
  state: "sent" | "failed" | "skipped"
  reason: string | null // why it failed or was skipped
  at: string
}
