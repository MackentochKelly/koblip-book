// Clients' reviews of their visits (docs/plans/client-account.md, D15).

export const REVIEW_RULES = {
  // The longest comment, in characters.
  maxComment: 500,
  // A review can be changed this many days after it was left.
  editDays: 14,
  // The client's bell asks for a review this long after the visit ends...
  askAfterHours: 2,
  // ...for visits that ended within this many days (older ones are never
  // asked about).
  askWithinDays: 7,
  // How many of the latest reviews the business page shows.
  latestShown: 5,
} as const

// Why an owner hides a review from their page. They can never edit it.
export const REVIEW_HIDE_REASONS = [
  "offensive",
  "personalInfo",
  "notAVisit",
  "spam",
] as const

export type ReviewHideReason = (typeof REVIEW_HIDE_REASONS)[number]

export function isReviewHideReason(value: unknown): value is ReviewHideReason {
  return REVIEW_HIDE_REASONS.some((reason) => reason === value)
}
