import { PAGE_LANGUAGES, type PageLanguage } from "@/lib/page-language"
import type { AutomationRules } from "@/lib/platform-settings"
import type { AutomationProblem } from "../types/automations"

export type AutomationIssue = { error: AutomationProblem; field: string }

// Rendered message data for the same checker the editor uses. The engine
// maps this validated content to Chat's public send API in B3.
export type AutomationMessageInput = {
  type: "button" | "cta_url" | "list"
  body: string
  header?: string
  footer?: string
  buttons?: { id: string; label: string }[]
  label?: string
  url?: string
  sections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[]
}

type ObjectValue = Record<string, unknown>
const object = (value: unknown): value is ObjectValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const issue = (error: AutomationProblem, field: string): AutomationIssue => ({ error, field })

function textProblem(
  value: unknown, field: string, max: number, fields: boolean, optional = false
): AutomationIssue | null {
  if (optional && value === undefined) return null
  if (typeof value !== "string") return issue("invalid", field)
  if (value.length > max) return issue("tooLong", field)
  if (!value.trim()) return optional ? null : issue("empty", field)
  // Stored wording supports one named field; rendered messages contain values.
  if (fields && /[{}]/.test(value.replaceAll("{business}", ""))) return issue("badField", field)
  return null
}

function singleLine(value: string, field: string): AutomationIssue | null {
  return /[\r\n\t{}]/.test(value) ? issue("badField", field) : null
}

function replyButtons(value: unknown, rules: AutomationRules, translated: boolean): AutomationIssue | null {
  if (!Array.isArray(value)) return issue("invalid", "buttons")
  if (!value.length) return issue("empty", "buttons")
  if (value.length > rules.maxButtons) return issue("tooManyButtons", "buttons")
  const ids = new Set<string>()
  const labels = Object.fromEntries(PAGE_LANGUAGES.map((language) => [language, new Set<string>()])) as Record<
    PageLanguage,
    Set<string>
  >
  const actions = new Set<string>()
  for (const [index, button] of value.entries()) {
    const field = `buttons.${index}`
    if (!object(button)) return issue("invalid", field)
    const idProblem = textProblem(button.id, `${field}.id`, rules.maxButtonId, false)
    if (idProblem) return idProblem
    if (button.id !== (button.id as string).trim() || /[\r\n\t]/.test(button.id as string)) return issue("badField", `${field}.id`)
    if (ids.has(button.id as string)) return issue("badField", `${field}.id`)
    ids.add(button.id as string)
    if (translated && !object(button.label)) return issue("invalid", `${field}.label`)
    for (const language of translated ? PAGE_LANGUAGES : (["en"] as const)) {
      const label = translated ? (button.label as ObjectValue)[language] : button.label
      const name = translated ? `${field}.label.${language}` : `${field}.label`
      const problem = textProblem(label, name, rules.maxButtonLabel, false)
      if (problem) return problem
      const line = singleLine(label as string, name)
      if (line) return line
      const normalized = (label as string).trim().toLowerCase()
      if (labels[language].has(normalized)) return issue("duplicateLabel", name)
      labels[language].add(normalized)
    }
    if (translated) {
      if (!object(button.action) || typeof button.action.type !== "string" || !["bookingLink", "servicesList", "handoff"].includes(button.action.type)) return issue("invalid", `${field}.action`)
      if (Object.keys(button.action).some((key) => key !== "type")) return issue("invalid", `${field}.action`)
      const action = button.action.type as string
      if (actions.has(action)) return issue("badField", `${field}.action`)
      actions.add(action)
    }
  }
  return null
}

// One checker for saved bilingual automation content and each rendered
// interactive message. Limits always come from the supplied stored rules.
export function automationProblem(input: unknown, rules: AutomationRules): AutomationIssue | null {
  if (!object(input)) return issue("invalid", "input")
  if (!("type" in input)) {
    if (!object(input.wording)) return issue("invalid", "wording")
    for (const language of PAGE_LANGUAGES) {
      const wording = input.wording[language]
      if (!object(wording)) return issue("invalid", `wording.${language}`)
      for (const key of ["body", "handoffReply", "servicesIntro"] as const) {
        const problem = textProblem(wording[key], `wording.${language}.${key}`,
          key === "servicesIntro" ? rules.maxListBody : rules.maxBody, true)
        if (problem) return problem
      }
    }
    return replyButtons(input.buttons, rules, true)
  }
  if (typeof input.type !== "string" || !["button", "cta_url", "list"].includes(input.type)) return issue("invalid", "type")
  const body = textProblem(input.body, "body", input.type === "list" ? rules.maxListBody : rules.maxBody, false)
  if (body) return body
  for (const [key, max] of [["header", rules.maxHeader], ["footer", rules.maxFooter]] as const) {
    const problem = textProblem(input[key], key, max, false, true)
    if (problem) return problem
  }
  if (input.type === "button") return replyButtons(input.buttons, rules, false)
  const label = textProblem(input.label, "label", rules.maxButtonLabel, false)
  if (label) return label
  const labelLine = singleLine(input.label as string, "label")
  if (labelLine) return labelLine
  if (input.type === "cta_url") {
    if (typeof input.url !== "string") return issue("invalid", "url")
    try {
      const url = new URL(input.url)
      if (!["https:", "http:"].includes(url.protocol)) return issue("invalid", "url")
    } catch {
      return issue("invalid", "url")
    }
    return null
  }
  if (!Array.isArray(input.sections)) return issue("invalid", "sections")
  if (!input.sections.length) return issue("empty", "sections")
  const ids = new Set<string>()
  let rows = 0
  for (const [sectionIndex, section] of input.sections.entries()) {
    const field = `sections.${sectionIndex}`
    if (!object(section)) return issue("invalid", field)
    const title = textProblem(section.title, `${field}.title`, rules.maxListSectionTitle, false, input.sections.length === 1)
    if (title) return title
    if (!Array.isArray(section.rows)) return issue("invalid", `${field}.rows`)
    if (!section.rows.length) return issue("empty", `${field}.rows`)
    rows += section.rows.length
    if (rows > rules.maxListRows) return issue("tooManyButtons", "sections")
    for (const [rowIndex, row] of section.rows.entries()) {
      const name = `${field}.rows.${rowIndex}`
      if (!object(row)) return issue("invalid", name)
      for (const [key, max, optional] of [["id", rules.maxListRowId, false], ["title", rules.maxListRowTitle, false], ["description", rules.maxListRowDescription, true]] as const) {
        const problem = textProblem(row[key], `${name}.${key}`, max, false, optional)
        if (problem) return problem
      }
      if (ids.has(row.id as string)) return issue("badField", `${name}.id`)
      ids.add(row.id as string)
    }
  }
  return null
}
