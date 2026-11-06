// A business's policies, shown on its booking page. The standard ones: when
// and how to cancel, its terms, and how it uses customers' details (the
// business is the one collecting them, so it owes them that notice: GDPR
// Article 13). Muse writes a first version at setup. The owner adds,
// edits or removes them in Settings, and adds their own, each with a title.
export const POLICY_KINDS = ["booking", "terms", "privacy"] as const

export type PolicyKind = (typeof POLICY_KINDS)[number]

// A policy as the page links to it. kind null: the owner's own, named by
// its title (in Spanish once translated); a standard one is named by the
// page's own words.
export interface PolicyLink {
  id: string
  kind: PolicyKind | null
  title: string | null
}

// Where a policy's page lives: /b/[slug]/policies/<this>. A standard one
// keeps its kind, so its address never changes; the owner's own uses its id.
export function policySegment(policy: Pick<PolicyLink, "id" | "kind">): string {
  return policy.kind ?? policy.id
}

// The one order policies show in, in Settings and on the page: the standard
// ones in POLICY_KINDS order, then the owner's own, oldest first.
export function orderPolicies<
  T extends { id: string; kind: PolicyKind | null; createdAt: string },
>(rows: readonly T[]): T[] {
  const rank = (row: T) =>
    row.kind === null ? POLICY_KINDS.length : POLICY_KINDS.indexOf(row.kind)
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  )
}

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
  // Policies per business, standard and own together, and characters per
  // own policy's title.
  maxPolicies: 10,
  maxTitle: 60,
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
