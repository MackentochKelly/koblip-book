export type ButtonsProblem = "tooManyButtons" | "badButton" | "sameButton"

export type WordingProblem =
  | "empty"
  | "tooLong"
  | "unknownField"
  | "fieldAtEdge"
  | "fieldsTogether"
  | "fieldInLine"
  | "lineBreak"
  | "fewWords"

// Koblip's ready-made WhatsApp messages as the admin reviews them (K2):
// shared by the server code that reads them and the admin screen.

export type KoblipLanguage = "en" | "es"

export type KoblipMessageName =
  | "confirmed"
  | "reminder"
  | "changed"
  | "cancelled"
  | "ownerNewBooking"
  | "ownerCantCome"
  | "ownerCancelled"
  | "ownerFailed"

// "draft": not submitted to Meta, or Book's wording changed since it was.
export type KoblipReview = "draft" | "waiting" | "approved" | "rejected"

export type KoblipButtonAction = "confirm" | "cantCome" | "ok"

export type KoblipText = {
  wording: { header: string; body: string; footer: string }
  buttons: { action: KoblipButtonAction; label: string }[]
  // The text with sample values, as a customer reads it.
  preview: string
  review: KoblipReview
  // Meta's reason when it refused, in Meta's words.
  reason: string | null
}

export type KoblipMessage = {
  message: KoblipMessageName
  texts: Record<KoblipLanguage, KoblipText>
}

export type KoblipSubmitResult =
  | { ok: true }
  | { ok: false; error: "notConnected" | "noNumber" | "not_found" }
  | { ok: false; error: "chat"; reason: string | null }

export type KoblipSaveResult =
  | { ok: true }
  | { ok: false; error: WordingProblem | ButtonsProblem | "not_found" | "invalid" }
