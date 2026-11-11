export const EMAIL_BASE = "/admin/email"

// The admin's Email parts, in order (docs/plans/email.md, EM-11). The first
// is the page itself, every email; each other part is its own route below
// it (app/(admin)/admin/email/).
export const EMAIL_PARTS = ["overview", "blocked", "rules"] as const

export type EmailPart = (typeof EMAIL_PARTS)[number]
