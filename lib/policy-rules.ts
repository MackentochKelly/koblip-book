// A business's own policies, shown on its booking page: when and how to
// cancel, its terms, and how it uses customers' details (the business is
// the one collecting them, so it owes them that notice: GDPR Article 13).
// Muse writes a first version at setup; the owner edits them in Settings.
export const POLICY_KINDS = ["booking", "terms", "privacy"] as const

export type PolicyKind = (typeof POLICY_KINDS)[number]

// The key points a customer agrees to in the booking flow's last step
// (cancelling, arriving, paying, ...), each a card with one of these icons.
export const POLICY_POINT_ICONS = [
  "calendar",
  "card",
  "clock",
  "image",
  "care",
  "info",
] as const

export type PolicyPointIcon = (typeof POLICY_POINT_ICONS)[number]

export const POLICY_RULES = {
  // Characters per policy, as written by Muse or the owner.
  maxLength: 3000,
  // Muse's drafts: long enough to say something real.
  minDraftLength: 200,
  attempts: 2,
  textTimeoutMs: 60_000,
  // Key points: how many, and characters per title and text.
  maxPoints: 4,
  minDraftPoints: 3,
  maxPointTitle: 40,
  maxPointBody: 220,
} as const

export function isPolicyKind(value: unknown): value is PolicyKind {
  return (POLICY_KINDS as readonly unknown[]).includes(value)
}

export function isPolicyPointIcon(value: unknown): value is PolicyPointIcon {
  return (POLICY_POINT_ICONS as readonly unknown[]).includes(value)
}
