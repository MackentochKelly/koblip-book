// The rules of the app's translations (docs/plans/translations.md). Plain
// values only: the database schema and drizzle-kit read this file too.

// The app's own words, or one business's texts.
export const TRANSLATION_SCOPES = ["interface", "business"] as const
export type TranslationScope = (typeof TRANSLATION_SCOPES)[number]

// One text in one language:
// - pending: waiting for Google (new, or its English changed);
// - failed: Google could not translate it after every retry;
// - automatic: Google's translation, shown;
// - edited: an admin's own translation, shown and never overwritten;
// - needs_review: an edited translation whose English changed since; still
//   shown until an admin looks at it.
export const TRANSLATION_STATUSES = [
  "pending",
  "failed",
  "automatic",
  "edited",
  "needs_review",
] as const
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number]

// Who made the translation the page shows. "meta" and "fake" ones are
// translated again by Google (no Meta translating, no test text live).
export const TRANSLATION_ORIGINS = [
  "google",
  "fake",
  "meta",
  "manual",
] as const
export type TranslationOrigin = (typeof TRANSLATION_ORIGINS)[number]

// What happened to a translation, for its history.
export const TRANSLATION_ACTIONS = [
  // Google translated it (its characters are billed).
  "google",
  // An earlier Google translation of the same English was reused.
  "memory",
  // Google failed after every retry.
  "failed",
  // The English changed.
  "source_changed",
  // An admin saved their own translation.
  "edited",
  // An admin asked for Google's translation again.
  "reset",
  // An admin retried a failed one.
  "retry",
  // It came from the app's earlier translations.
  "imported",
] as const
export type TranslationAction = (typeof TRANSLATION_ACTIONS)[number]

// The page shows a translation in these states; otherwise the English.
export function isShown(status: TranslationStatus): boolean {
  return (
    status === "automatic" || status === "edited" || status === "needs_review"
  )
}

export const TRANSLATION_RULES = {
  // Minutes before each retry after a failed try; one more failure after
  // the last one marks the text Failed.
  retryMinutes: [1, 5, 30, 120],
  // Characters per request to Google: 5,000 is Google's recommended size,
  // 30,000 its limit (docs.cloud.google.com/translate/quotas).
  requestCharacters: 5_000,
  maxTextCharacters: 30_000,
  // Texts per request, well inside Google's limits.
  requestTexts: 100,
  // Characters one business may send to Google per day (UTC); the rest
  // waits for the next day. Demo guests can save too.
  dailyBusinessCharacters: 50_000,
  // Texts taken from the queue per run.
  runTexts: 500,
  // Seconds between the timer's runs.
  timerSeconds: 60,
  // How long Google may take per request.
  requestTimeoutMs: 15_000,
} as const
