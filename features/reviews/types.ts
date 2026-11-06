import type { ReviewHideReason } from "@/lib/review-rules"

// One review as the business page shows it: the client's first name only.
export type PublicReview = {
  id: string
  authorName: string
  stars: number
  comment: string | null
  // When it was left (ISO).
  at: string
}

export type ReviewSummary = {
  // Out of 5, one decimal; null with no reviews shown.
  average: number | null
  count: number
  latest: PublicReview[]
}

// The client's own review of one visit, for the booking's page.
export type MyReview = {
  // The visit is over and wasn't cancelled: it can be reviewed.
  canReview: boolean
  review: { stars: number; comment: string | null; editable: boolean } | null
}

// A review in the owner's and the admin's lists.
export type ListedReview = PublicReview & {
  businessName: string
  serviceName: string
  hiddenReason: ReviewHideReason | null
}

export type ReviewResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "invalid" | "too_late" }
