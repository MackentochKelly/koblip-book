import "server-only"

import {
  isStructurallySame,
  type MessageFormatElement,
  parse,
  TYPE,
} from "@formatjs/icu-messageformat-parser"
import { and, eq, isNull } from "drizzle-orm"
import type { Messages } from "next-intl"
import ts from "typescript"
import { db } from "@/lib/db"
import { translationEntries } from "@/lib/db/schema"
import { sameIcuFields } from "./icu"
import { flattenWords } from "./interface-words"
import { SOURCE_LANGUAGE } from "./languages"
import { isShown, type TranslationOrigin, type TranslationStatus } from "./rules"

// The coverage check of the app's own words (docs/plans/translations.md,
// G6; `npm run i18n:check` and i18n/messages.test.ts): every English word is
// a valid ICU message, every word has every language in the database, a
// translation has the English's fields and its language's plural forms, and
// no English is left on a page in another language.

export const COVERAGE_CHECKS = {
  englishNotText: {
    severity: "error",
    label: "English word is not text",
  },
  englishNotIcu: {
    severity: "error",
    label: "English is not a valid ICU message",
  },
  missing: {
    severity: "error",
    label: "no translation (English shows)",
  },
  waiting: {
    severity: "error",
    label: "waiting for Google (English shows)",
  },
  failed: {
    severity: "error",
    label: "Google failed (English shows)",
  },
  notIcu: {
    severity: "error",
    label: "translation is not a valid ICU message (English shows)",
  },
  fields: {
    severity: "error",
    label: "fields differ from the English (English shows)",
  },
  selectOptions: {
    severity: "error",
    label: "a select lacks an option the English has",
  },
  typedEnglish: {
    severity: "error",
    label: "English typed into a page instead of a word file",
  },
  pluralForms: {
    severity: "warning",
    label: "a plural lacks a form of its language (other shows)",
  },
  sameAsEnglish: {
    severity: "warning",
    label: "same as the English",
  },
  outOfDate: {
    severity: "warning",
    label: "English changed since (synced at the next server start)",
  },
  needsReview: {
    severity: "warning",
    label: "edited, and the English changed since: needs review",
  },
  fake: {
    severity: "warning",
    label: "test text from the fake translator",
  },
} as const satisfies Record<
  string,
  { severity: "error" | "warning"; label: string }
>

export type CoverageCheck = keyof typeof COVERAGE_CHECKS
export type CoverageSeverity = (typeof COVERAGE_CHECKS)[CoverageCheck]["severity"]

export interface CoverageFinding {
  check: CoverageCheck
  // The language a translation's finding is about ("en" for the English).
  language?: string
  // The word's key, or "file:line" for English typed into a page.
  where: string
  detail?: string
}

export function severityOf(finding: CoverageFinding): CoverageSeverity {
  return COVERAGE_CHECKS[finding.check].severity
}

// Names that stay as they are in every language: brands, and each
// language's own name in a language menu.
export const KEPT_NAMES = [
  "Koblip Book",
  "Koblip Chat",
  "Koblip",
  "Google Calendar",
  "Google Maps",
  "Google",
  "WhatsApp",
  "Meta AI",
  "Meta",
  "Muse",
  "ElevenLabs",
  "Instagram",
  "Facebook",
  "TikTok",
  "Apple",
  "iPhone",
  "iPad",
  "Android",
  "Gmail",
  "Outlook",
  "Stripe",
  "English",
  "Español",
  "Português",
  "Français",
] as const

const KEPT_NAME = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...KEPT_NAMES]
    .sort((a, b) => b.length - a.length)
    .join("|")})(?![\\p{L}\\p{N}])`,
  "gu"
)

// Links, emails, web addresses and HTML entities (&nbsp;) aren't words.
const NOT_WORDS = [
  /https?:\/\/\S*/g,
  /[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g,
  /&(?:#\d+|#x[\da-f]+|[a-z]+);/gi,
]

// The text has words to translate: two letters in a row left once kept
// names, links, emails and entities are taken out. Symbols ("·", "→",
// "%"), numbers and a letter on its own ("1.5x", "⌘K") don't count.
export function hasWords(text: string): boolean {
  let rest = text.replace(KEPT_NAME, " ")
  for (const pattern of NOT_WORDS) rest = rest.replace(pattern, " ")
  return /\p{L}\p{M}*\p{L}/u.test(rest)
}

// The forms a language's plurals have
// (Intl.PluralRules resolvedOptions().pluralCategories): Spanish, French
// and Portuguese have one, many and other.
export function pluralForms(language: string, ordinal = false): string[] {
  return new Intl.PluralRules(language, {
    type: ordinal ? "ordinal" : "cardinal",
  }).resolvedOptions().pluralCategories
}

// The English words, each a valid ICU message whose plurals and selects
// have `other`, and whose plurals have the forms English has.
export function checkEnglishWords(english: Messages): CoverageFinding[] {
  const findings: CoverageFinding[] = []
  for (const key of notTextWords(english)) {
    findings.push({ check: "englishNotText", where: key })
  }
  for (const { key, text } of flattenWords(english)) {
    const read = readIcu(text)
    if ("problem" in read) {
      findings.push({ check: "englishNotIcu", where: key, detail: read.problem })
      continue
    }
    for (const missing of missingPluralForms(read.ast, SOURCE_LANGUAGE, read.ast)) {
      findings.push({
        check: "pluralForms",
        language: SOURCE_LANGUAGE,
        where: key,
        detail: missing,
      })
    }
  }
  return findings
}

// One interface word's row in `translation_entries`.
export interface InterfaceTranslation {
  key: string
  language: string
  text: string | null
  status: TranslationStatus
  origin: TranslationOrigin | null
  sourceText: string
}

// Every English word in every language: shown, with the English's fields
// and select options, the language's plural forms, and not the English
// itself.
export function checkTranslations({
  english,
  rows,
  languages,
}: {
  english: Messages
  rows: readonly InterfaceTranslation[]
  languages: readonly string[]
}): CoverageFinding[] {
  const findings: CoverageFinding[] = []
  const byKey = new Map(rows.map((row) => [`${row.language}\u0000${row.key}`, row]))
  for (const word of flattenWords(english)) {
    const source = readIcu(word.text)
    for (const language of languages) {
      const found = (check: CoverageCheck, detail?: string) =>
        findings.push({ check, language, where: word.key, detail })
      const row = byKey.get(`${language}\u0000${word.key}`)
      if (!row) {
        found("missing")
        continue
      }
      if (!isShown(row.status) || row.text === null) {
        found(row.status === "failed" ? "failed" : "waiting")
        continue
      }
      if (row.origin === "fake") found("fake")
      if (row.sourceText !== word.text) found("outOfDate")
      if (row.status === "needs_review") found("needsReview")
      // A broken English is reported once, by checkEnglishWords.
      if ("problem" in source) continue
      const target = readIcu(row.text)
      if ("problem" in target) {
        found("notIcu", target.problem)
        continue
      }
      if (!sameIcuFields(word.text, row.text)) {
        found("fields", isStructurallySame(source.ast, target.ast).error?.message)
        continue
      }
      const lacking = missingSelectOptions(source.ast, target.ast)
      if (lacking.length > 0) found("selectOptions", lacking.join("; "))
      for (const missing of missingPluralForms(target.ast, language, source.ast)) {
        found("pluralForms", missing)
      }
      if (row.text === word.text && hasWords(literalText(source.ast))) {
        found("sameAsEnglish")
      }
    }
  }
  return findings
}

// The app's words in the database (scope "interface").
export async function interfaceTranslations(): Promise<InterfaceTranslation[]> {
  return db
    .select({
      key: translationEntries.key,
      language: translationEntries.language,
      text: translationEntries.text,
      status: translationEntries.status,
      origin: translationEntries.origin,
      sourceText: translationEntries.sourceText,
    })
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.scope, "interface"),
        isNull(translationEntries.businessId)
      )
    )
}

// The page files whose JSX is read for English: .tsx, not tests or stories,
// not word files (an i18n folder).
export function isPageSource(path: string): boolean {
  const parts = path.split("/")
  return (
    path.endsWith(".tsx") &&
    !/\.(test|spec|stories)\.tsx$/.test(path) &&
    !parts.includes("i18n") &&
    !parts.includes("__tests__")
  )
}

// English typed straight into pages: JSX text, the strings a JSX
// expression shows ({open ? "Open" : "Closed"}), and text props people
// see or hear (aria-label, placeholder, title, alt).
export function checkTypedEnglish(
  files: readonly { path: string; source: string }[]
): CoverageFinding[] {
  return files.flatMap(({ path, source }) =>
    findTypedEnglish(path, source).map(({ line, text }) => ({
      check: "typedEnglish" as const,
      where: `${path}:${line}`,
      detail: text.length > 60 ? `${text.slice(0, 59)}…` : text,
    }))
  )
}

const TEXT_PROPS = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "placeholder",
  "title",
])

// Elements whose text is code, not words.
const CODE_ELEMENTS = new Set(["code", "kbd", "pre", "script", "style"])

export function findTypedEnglish(
  path: string,
  source: string
): { line: number; text: string }[] {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const found: { line: number; text: string }[] = []
  const report = (node: ts.Node, text: string) => {
    if (!hasWords(text)) return
    const start = node.getStart(file)
    const lead = Math.max(file.text.slice(start, node.end).search(/\S/), 0)
    const { line } = file.getLineAndCharacterOfPosition(start + lead)
    found.push({ line: line + 1, text: text.replace(/\s+/g, " ").trim() })
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxElement(node) &&
      CODE_ELEMENTS.has(node.openingElement.tagName.getText(file))
    ) {
      return
    }
    if (ts.isJsxText(node)) {
      report(node, node.text)
    } else if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      TEXT_PROPS.has(node.name.getText(file))
    ) {
      const value = node.initializer
      if (ts.isStringLiteral(value)) report(value, value.text)
      else if (ts.isJsxExpression(value) && value.expression) {
        for (const shown of shownStrings(value.expression)) {
          report(shown, stringText(shown))
        }
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      for (const shown of shownStrings(node.expression)) {
        report(shown, stringText(shown))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

type StringNode =
  | ts.StringLiteral
  | ts.NoSubstitutionTemplateLiteral
  | ts.TemplateExpression

// The strings an expression shows as it is: a literal, a template, either
// side of a condition, "a" + b. Calls (t("key")) and names show no typed
// text.
function shownStrings(expression: ts.Expression): StringNode[] {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isTemplateExpression(expression)
  ) {
    return [expression]
  }
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return shownStrings(expression.expression)
  }
  if (ts.isConditionalExpression(expression)) {
    return [...shownStrings(expression.whenTrue), ...shownStrings(expression.whenFalse)]
  }
  if (ts.isBinaryExpression(expression)) {
    switch (expression.operatorToken.kind) {
      case ts.SyntaxKind.AmpersandAmpersandToken:
        return shownStrings(expression.right)
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.QuestionQuestionToken:
      case ts.SyntaxKind.PlusToken:
        return [...shownStrings(expression.left), ...shownStrings(expression.right)]
    }
  }
  return []
}

// A template's typed parts, without its ${…}.
function stringText(node: StringNode): string {
  if (!ts.isTemplateExpression(node)) return node.text
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ")
}

export interface CoverageGroup {
  check: CoverageCheck
  severity: CoverageSeverity
  label: string
  language?: string
  findings: CoverageFinding[]
}

// Findings by check and language: errors first, in COVERAGE_CHECKS order.
export function groupFindings(findings: readonly CoverageFinding[]): CoverageGroup[] {
  const groups = new Map<string, CoverageGroup>()
  for (const finding of findings) {
    const id = `${finding.check}\u0000${finding.language ?? ""}`
    let group = groups.get(id)
    if (!group) {
      const { severity, label } = COVERAGE_CHECKS[finding.check]
      group = { check: finding.check, severity, label, language: finding.language, findings: [] }
      groups.set(id, group)
    }
    group.findings.push(finding)
  }
  const order = Object.keys(COVERAGE_CHECKS) as CoverageCheck[]
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.severity === "warning") - Number(b.severity === "warning") ||
      order.indexOf(a.check) - order.indexOf(b.check) ||
      (a.language ?? "").localeCompare(b.language ?? "")
  )
}

type Tree = { [key: string]: unknown }

// Keys whose value is neither text nor a group of words (a leftover
// function from the old word files).
function notTextWords(words: Messages): string[] {
  const keys: string[] = []
  const walk = (tree: Tree, prefix: string) => {
    for (const [name, value] of Object.entries(tree)) {
      const key = prefix ? `${prefix}.${name}` : name
      if (typeof value === "string") continue
      if (value !== null && typeof value === "object") walk(value as Tree, key)
      else keys.push(key)
    }
  }
  walk(words as unknown as Tree, "")
  return keys
}

// The message's elements, or what is wrong with it. Plurals and selects
// must have `other`: ICU falls back to it.
function readIcu(
  text: string
): { ast: MessageFormatElement[] } | { problem: string } {
  try {
    return { ast: parse(text, { requiresOtherClause: true }) }
  } catch (error) {
    const kind = error instanceof Error ? error.message : String(error)
    return {
      problem:
        kind === "MISSING_OTHER_CLAUSE"
          ? "a plural or select has no other"
          : kind.toLowerCase().replaceAll("_", " "),
    }
  }
}

interface Choice {
  name: string
  plural: boolean
  ordinal: boolean
  options: string[]
}

// Every plural and select, nested ones and those inside tags too.
function choicesOf(elements: MessageFormatElement[], out: Choice[] = []): Choice[] {
  for (const element of elements) {
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      out.push({
        name: element.value,
        plural: element.type === TYPE.plural,
        ordinal: element.type === TYPE.plural && element.pluralType === "ordinal",
        options: Object.keys(element.options),
      })
      for (const option of Object.values(element.options)) {
        choicesOf(option.value, out)
      }
    } else if (element.type === TYPE.tag) {
      choicesOf(element.children, out)
    }
  }
  return out
}

// Each plural's missing forms ("count: many"): the forms of its language,
// and the exact numbers (=0) the English plural has.
function missingPluralForms(
  ast: MessageFormatElement[],
  language: string,
  english: MessageFormatElement[]
): string[] {
  const exact = new Map<string, Set<string>>()
  for (const choice of choicesOf(english)) {
    if (!choice.plural) continue
    const set = exact.get(choice.name) ?? new Set()
    for (const option of choice.options) if (option.startsWith("=")) set.add(option)
    exact.set(choice.name, set)
  }
  const missing = new Set<string>()
  for (const choice of choicesOf(ast)) {
    if (!choice.plural) continue
    const needed = [...pluralForms(language, choice.ordinal), ...(exact.get(choice.name) ?? [])]
    const lacking = needed.filter((form) => !choice.options.includes(form))
    if (lacking.length > 0) missing.add(`${choice.name}: ${lacking.join(", ")}`)
  }
  return [...missing]
}

// The English selects' options a translation lacks ("kind: phone").
function missingSelectOptions(
  english: MessageFormatElement[],
  translation: MessageFormatElement[]
): string[] {
  const options = (ast: MessageFormatElement[]) => {
    const byName = new Map<string, Set<string>>()
    for (const choice of choicesOf(ast)) {
      if (choice.plural) continue
      const set = byName.get(choice.name) ?? new Set()
      for (const option of choice.options) set.add(option)
      byName.set(choice.name, set)
    }
    return byName
  }
  const has = options(translation)
  const lacking: string[] = []
  for (const [name, wanted] of options(english)) {
    const missing = [...wanted].filter((option) => !has.get(name)?.has(option))
    if (missing.length > 0) lacking.push(`${name}: ${missing.join(", ")}`)
  }
  return lacking
}

// A message's own words, without fields, tags' names or plural frames.
function literalText(elements: MessageFormatElement[]): string {
  return elements
    .map((element) => {
      if (element.type === TYPE.literal) return element.value
      if (element.type === TYPE.tag) return literalText(element.children)
      if (element.type === TYPE.plural || element.type === TYPE.select) {
        return Object.values(element.options)
          .map((option) => literalText(option.value))
          .join(" ")
      }
      return " "
    })
    .join("")
}
