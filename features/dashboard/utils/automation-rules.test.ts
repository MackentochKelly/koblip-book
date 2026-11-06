// @vitest-environment node
import { expect, test, vi } from "vitest"
import { AUTOMATION_RULES, type AutomationRules } from "@/lib/platform-settings"
import { WELCOME_WORDS } from "../api/message-words.captured"
import { welcomeDefaults } from "./automation-defaults"
import { automationProblem, type AutomationMessageInput } from "./automation-rules"

vi.mock("server-only", () => ({}))

const reply = (): AutomationMessageInput => ({ type: "button", body: "Choose an option.", buttons: [{ id: "book", label: "Book now" }] })
const link = (): AutomationMessageInput => ({ type: "cta_url", body: "Book your visit.", label: "Book now", url: "https://example.test/book" })
const list = (): AutomationMessageInput => ({ type: "list", body: "Choose a service.", label: "Services", sections: [{ title: "Services", rows: [{ id: "service-1", title: "Consultation", description: "A short visit" }] }] })

function changed(input: unknown, path: string, value: unknown) {
  const result = structuredClone(input) as Record<string, unknown>
  const keys = path.split(".")
  let parent = result
  for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>
  parent[keys.at(-1)!] = value
  return result
}

const textLimits: {
  name: string
  make: () => AutomationMessageInput
  field: string
  limit: number
  rule: keyof AutomationRules
}[] = [
  { name: "reply label", make: reply, field: "buttons.0.label", limit: 20, rule: "maxButtonLabel" },
  { name: "reply id", make: reply, field: "buttons.0.id", limit: 256, rule: "maxButtonId" },
  { name: "reply body", make: reply, field: "body", limit: 1024, rule: "maxBody" },
  { name: "reply footer", make: reply, field: "footer", limit: 60, rule: "maxFooter" },
  { name: "link label", make: link, field: "label", limit: 20, rule: "maxButtonLabel" },
  { name: "link body", make: link, field: "body", limit: 1024, rule: "maxBody" },
  { name: "link header", make: link, field: "header", limit: 60, rule: "maxHeader" },
  { name: "link footer", make: link, field: "footer", limit: 60, rule: "maxFooter" },
  { name: "list row title", make: list, field: "sections.0.rows.0.title", limit: 24, rule: "maxListRowTitle" },
  { name: "list row description", make: list, field: "sections.0.rows.0.description", limit: 72, rule: "maxListRowDescription" },
  { name: "list row id", make: list, field: "sections.0.rows.0.id", limit: 200, rule: "maxListRowId" },
  { name: "list button", make: list, field: "label", limit: 20, rule: "maxButtonLabel" },
  { name: "list body", make: list, field: "body", limit: 4096, rule: "maxListBody" },
  { name: "list header", make: list, field: "header", limit: 60, rule: "maxHeader" },
  { name: "list footer", make: list, field: "footer", limit: 60, rule: "maxFooter" },
  { name: "list section title", make: list, field: "sections.0.title", limit: 24, rule: "maxListSectionTitle" },
]

test.each(textLimits)("$name accepts the Meta boundary and rejects one character more", ({ make, field, limit, rule }) => {
  expect(AUTOMATION_RULES[rule]).toBe(limit)
  expect(automationProblem(changed(make(), field, "x".repeat(limit)), AUTOMATION_RULES)).toBeNull()
  expect(automationProblem(changed(make(), field, "x".repeat(limit + 1)), AUTOMATION_RULES)).toEqual({ error: "tooLong", field })
})

test.each(textLimits)("$name obeys a stricter supplied rule", ({ make, field, rule }) => {
  const rules: AutomationRules = { ...AUTOMATION_RULES, [rule]: 1 }
  expect(automationProblem(changed(make(), field, "x"), rules)).toBeNull()
  expect(automationProblem(changed(make(), field, "xx"), rules)).toEqual({ error: "tooLong", field })
})

test("reply buttons allow three, reject four and obey a lower stored count", () => {
  const buttons = Array.from({ length: 4 }, (_, index) => ({ id: `id-${index}`, label: `Option ${index}` }))
  expect(AUTOMATION_RULES.maxButtons).toBe(3)
  expect(automationProblem({ ...reply(), buttons: buttons.slice(0, 3) }, AUTOMATION_RULES)).toBeNull()
  expect(automationProblem({ ...reply(), buttons }, AUTOMATION_RULES)).toEqual({ error: "tooManyButtons", field: "buttons" })
  expect(automationProblem({ ...reply(), buttons: buttons.slice(0, 2) }, { ...AUTOMATION_RULES, maxButtons: 1 })).toEqual({ error: "tooManyButtons", field: "buttons" })
})

test("list rows are limited to ten across all sections, including with a lower stored limit", () => {
  const section = (offset: number, length: number) => ({ title: `Group ${offset}`, rows: Array.from({ length }, (_, index) => ({ id: `row-${offset + index}`, title: `Service ${offset + index}` })) })
  expect(AUTOMATION_RULES.maxListRows).toBe(10)
  expect(automationProblem({ ...list(), sections: [section(0, 5), section(5, 5)] }, AUTOMATION_RULES)).toBeNull()
  expect(automationProblem({ ...list(), sections: [section(0, 5), section(5, 6)] }, AUTOMATION_RULES)).toEqual({ error: "tooManyButtons", field: "sections" })
  expect(automationProblem({ ...list(), sections: [section(0, 1), section(1, 1)] }, { ...AUTOMATION_RULES, maxListRows: 1 })).toEqual({ error: "tooManyButtons", field: "sections" })
})

test("Book's bilingual defaults and each supported outgoing message pass the same validator", () => {
  expect(automationProblem(welcomeDefaults(WELCOME_WORDS), AUTOMATION_RULES)).toBeNull()
  expect(automationProblem(reply(), AUTOMATION_RULES)).toBeNull()
  expect(automationProblem(link(), AUTOMATION_RULES)).toBeNull()
  expect(automationProblem(list(), AUTOMATION_RULES)).toBeNull()
})

test.each([
  { input: { ...reply(), buttons: [] }, field: "buttons" },
  { input: { ...welcomeDefaults(WELCOME_WORDS), buttons: [] }, field: "buttons" },
  { input: { ...list(), sections: [] }, field: "sections" },
  { input: changed(list(), "sections.0.rows", []), field: "sections.0.rows" },
  { input: { ...link(), label: " " }, field: "label" },
  { input: { ...list(), label: " " }, field: "label" },
])("zero controls are rejected at $field", ({ input, field }) => {
  expect(automationProblem(input, AUTOMATION_RULES)).toEqual({ error: "empty", field })
})

test.each(["en", "es"] as const)("saved labels must be distinct in %s, ignoring case and outer spaces", (language) => {
  const input = welcomeDefaults(WELCOME_WORDS)
  input.buttons[1].label[language] = ` ${input.buttons[0].label[language].toUpperCase()} `
  expect(automationProblem(input, AUTOMATION_RULES)).toEqual({ error: "duplicateLabel", field: `buttons.1.label.${language}` })
})

test("saved button actions and ids cannot repeat", () => {
  const sameAction = welcomeDefaults(WELCOME_WORDS)
  sameAction.buttons[1].action = sameAction.buttons[0].action
  expect(automationProblem(sameAction, AUTOMATION_RULES)).toEqual({ error: "badField", field: "buttons.1.action" })
  const sameId = welcomeDefaults(WELCOME_WORDS)
  sameId.buttons[1].id = sameId.buttons[0].id
  expect(automationProblem(sameId, AUTOMATION_RULES)).toEqual({ error: "badField", field: "buttons.1.id" })
})

test("outgoing reply controls require distinct labels and ids", () => {
  expect(automationProblem({ ...reply(), buttons: [{ id: "a", label: "Book" }, { id: "b", label: " BOOK " }] }, AUTOMATION_RULES)).toEqual({ error: "duplicateLabel", field: "buttons.1.label" })
  expect(automationProblem({ ...reply(), buttons: [{ id: "a", label: "Book" }, { id: "a", label: "Ask" }] }, AUTOMATION_RULES)).toEqual({ error: "badField", field: "buttons.1.id" })
})

test("row ids must be unique across sections", () => {
  expect(automationProblem({ ...list(), sections: [{ title: "One", rows: [{ id: "same", title: "First" }] }, { title: "Two", rows: [{ id: "same", title: "Second" }] }] }, AUTOMATION_RULES)).toEqual({ error: "badField", field: "sections.1.rows.0.id" })
})

const savedTextCases = (["en", "es"] as const).flatMap((language) => (["body", "handoffReply", "servicesIntro"] as const).map((key) => ({ language, key })))
test.each(savedTextCases)("saved $language $key accepts only the business field", ({ language, key }) => {
  const field = `wording.${language}.${key}`
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "Welcome to {business}, we are happy to help."), AUTOMATION_RULES)).toBeNull()
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "Hello {customer}, we are happy to help."), AUTOMATION_RULES)).toEqual({ error: "badField", field })
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "Welcome to {business, we can help."), AUTOMATION_RULES)).toEqual({ error: "badField", field })
})

test.each(savedTextCases)("saved $language $key respects its body limit", ({ language, key }) => {
  const field = `wording.${language}.${key}`
  const max = key === "servicesIntro" ? AUTOMATION_RULES.maxListBody : AUTOMATION_RULES.maxBody
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "x".repeat(max)), AUTOMATION_RULES)).toBeNull()
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "x".repeat(max + 1)), AUTOMATION_RULES)).toEqual({ error: "tooLong", field })
})

test.each([null, undefined, false, 42, "hello", [], {}, { wording: null }, { wording: { en: {}, es: {} } }, { ...reply(), buttons: null }, { ...reply(), buttons: [null] }, { ...link(), url: "javascript:alert(1)" }, { ...list(), sections: null }, { ...list(), sections: [null] }, { ...list(), sections: [{ rows: [null] }] }, { ...reply(), type: "unknown" }])("malformed input is rejected without throwing: %#", (input) => {
  expect(automationProblem(input, AUTOMATION_RULES)).toMatchObject({ error: "invalid", field: expect.any(String) })
})

test.each(["en", "es"] as const)("saved %s labels reject fields and line breaks", (language) => {
  const field = `buttons.0.label.${language}`
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "{business}"), AUTOMATION_RULES)).toEqual({ error: "badField", field })
  expect(automationProblem(changed(welcomeDefaults(WELCOME_WORDS), field, "Book\nnow"), AUTOMATION_RULES)).toEqual({ error: "badField", field })
})

test("button ids cannot contain leading spaces or line breaks", () => {
  expect(automationProblem(changed(reply(), "buttons.0.id", " book"), AUTOMATION_RULES)).toEqual({ error: "badField", field: "buttons.0.id" })
  expect(automationProblem(changed(reply(), "buttons.0.id", "book\nnow"), AUTOMATION_RULES)).toEqual({ error: "badField", field: "buttons.0.id" })
})


test.each([
  { input: changed(welcomeDefaults(WELCOME_WORDS), "buttons.0.action.type", ["handoff"]), field: "buttons.0.action" },
  { input: { ...list(), type: ["list"] }, field: "type" },
])("array-valued discriminants cannot impersonate a supported type: $field", ({ input, field }) => {
  expect(automationProblem(input, AUTOMATION_RULES)).toEqual({ error: "invalid", field })
})
