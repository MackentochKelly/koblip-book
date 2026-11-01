import { expect, test } from "vitest"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { onboardingWordsFor } from "./i18n"

for (const language of ["en", "es"] as const) {
  const words = onboardingWordsFor(language)
  for (const line of [...words.businessNameExamples, words.businessName]) {
    test(`${language}: search hint "${line}" stays within the shared limit`, () => {
      expect(line.length).toBeLessThanOrEqual(ONBOARDING_RULES.maxHintLength)
    })
  }
}
