import { useLocale, useTranslations } from "next-intl"

import { rewardWords } from "@/lib/reward-words"

// A reward rule in words (lib/reward-words.ts), for a component.
export function useRewardWords(currency: string) {
  const t = useTranslations("app.rewards")
  const locale = useLocale()
  return rewardWords(t, locale, currency)
}
