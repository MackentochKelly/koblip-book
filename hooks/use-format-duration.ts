import { useTranslations } from "next-intl"
import { useCallback } from "react"

import { durationIn } from "@/lib/format-duration"

// A length of time in the page's words ("1 h 30 min"), for a component.
// The same function between renders (next-intl keeps its translator), so it
// can sit in an effect's dependencies.
export function useFormatDuration() {
  const t = useTranslations("app.duration")
  return useCallback((minutes: number) => durationIn(t, minutes), [t])
}
