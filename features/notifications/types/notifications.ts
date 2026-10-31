import type { InAppData, InAppKind } from "@/types/in-app-notifications"

// The bell's contract (docs/plans/in-app-notifications.md, N1): what the
// server gives the bell. The words come from `kind` + `data` on screen, in
// the reader's language.

export type InAppNotification = {
  id: string
  kind: InAppKind
  businessId: string
  businessName: string
  // The business's time zone, for `data.startAt`.
  timezone: string
  data: InAppData
  // A path in the owner area.
  link: string
  read: boolean
  // When it happened (ISO).
  at: string
}

export type InAppPage = {
  items: InAppNotification[]
  // Pass back as `cursor` for the next, older page; null on the last one.
  nextCursor: string | null
}

// What GET /api/notifications answers.
export type InAppFeed = { unread: number; page: InAppPage }

export type InAppActionResult = { ok: true } | { ok: false; error: "not_found" }

// The owner's choices for one business (N3): every kind, on or off.
export type InAppChoice = { kind: InAppKind; on: boolean }

export type InAppChoiceResult = { ok: true } | { ok: false; error: "not_found" | "invalid" }
