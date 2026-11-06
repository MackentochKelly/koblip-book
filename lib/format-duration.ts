import type { createTranslator, Messages } from "next-intl"

// The app.duration words, from useTranslations or getTranslations.
export type DurationWords = ReturnType<
  typeof createTranslator<Messages, "app.duration">
>

// A length of time in the given words ("45 min", "2 h", "1 h 30 min").
// A component uses useFormatDuration (hooks/use-format-duration.ts).
export function durationIn(t: DurationWords, total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return t("minutes", { minutes: total })
  if (minutes === 0) return t("hours", { hours })
  return t("hoursMinutes", { hours, minutes })
}
