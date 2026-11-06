import { expect, test } from "vitest"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import words from "./i18n/en"

for (const line of [...Object.values(words.businessNameExamples), words.businessName]) {
  test(`search hint "${line}" stays within the shared limit`, () => {
    expect(line.length).toBeLessThanOrEqual(ONBOARDING_RULES.maxHintLength)
  })
}
