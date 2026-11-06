// @vitest-environment node
import { expect, test, vi } from "vitest"
import { checkEnglishWords, severityOf } from "@/lib/translations/coverage"
import { sameIcuFields } from "@/lib/translations/icu"
import { flattenWords } from "@/lib/translations/interface-words"
import { pseudoWords } from "@/lib/translations/pseudo"
import messages from "./messages"

vi.mock("server-only", () => ({}))

// The real catalog (docs/plans/translations.md, G6): every English word is
// text, a valid ICU message, and its plurals and selects have `other`.
// `npm run i18n:check` also checks the other languages in the database.
test("every English word is a valid ICU message with other in its plurals and selects", () => {
  const errors = checkEnglishWords(messages).filter(
    (finding) => severityOf(finding) === "error"
  )
  expect(errors).toEqual([])
})

// I18N_PSEUDO=1 (i18n/request.ts) must never break a page.
test("the pseudo-language keeps every word's fields, plurals and tags", () => {
  const pseudo = new Map(
    flattenWords(pseudoWords(messages)).map(({ key, text }) => [key, text])
  )
  const broken = flattenWords(messages)
    .filter(({ key, text }) => !sameIcuFields(text, pseudo.get(key) ?? ""))
    .map(({ key }) => key)
  expect(broken).toEqual([])
})
