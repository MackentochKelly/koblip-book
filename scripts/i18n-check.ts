import { readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, sep } from "node:path"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { default: messages } = await import("../i18n/messages")
const {
  checkEnglishWords,
  checkTranslations,
  checkTypedEnglish,
  groupFindings,
  interfaceTranslations,
  isPageSource,
} = await import("../lib/translations/coverage")
const { TRANSLATION_LANGUAGES } = await import("../lib/translations/languages")
const { flattenWords } = await import("../lib/translations/interface-words")

// The coverage check of the app's own words (docs/plans/translations.md,
// G6), against the database the app uses (DATABASE_URL in .env.local).
// Exits with 1 when there is an error, 0 with warnings only.
//
//   npm run i18n:check            counts, and the first few of each
//   npm run i18n:check -- --all   every finding
const SHOWN_PER_GROUP = process.argv.includes("--all") ? Infinity : 5
const PAGE_FOLDERS = ["app", "features", "components"]

const root = process.cwd()
const pages = PAGE_FOLDERS.flatMap((folder) =>
  readdirSync(join(root, folder), { recursive: true, encoding: "utf8" }).map(
    (path) => `${folder}/${path.split(sep).join("/")}`
  )
)
  .filter(isPageSource)
  .sort()
  .map((path) => ({ path, source: readFileSync(join(root, path), "utf8") }))

const words = flattenWords(messages)
const findings = [
  ...checkEnglishWords(messages),
  ...checkTranslations({
    english: messages,
    rows: await interfaceTranslations(),
    languages: TRANSLATION_LANGUAGES,
  }),
  ...checkTypedEnglish(pages),
]
const groups = groupFindings(findings)

const count = (n: number) => n.toLocaleString("en-US")
const errors = groups
  .filter((group) => group.severity === "error")
  .reduce((sum, group) => sum + group.findings.length, 0)
const warnings = findings.length - errors

console.log(
  `i18n check: ${count(words.length)} English words · languages ${TRANSLATION_LANGUAGES.join(", ")} · ${count(pages.length)} page files read`
)
if (groups.length === 0) {
  console.log("✓ Nothing to fix")
}
const width = Math.max(...groups.map((group) => count(group.findings.length).length), 1)
for (const group of groups) {
  const mark = group.severity === "error" ? "✗" : "!"
  const language = group.language ? `${group.language}: ` : ""
  console.log(
    `\n${mark} ${count(group.findings.length).padStart(width)}  ${language}${group.label}`
  )
  for (const finding of group.findings.slice(0, SHOWN_PER_GROUP)) {
    console.log(`    ${finding.where}${finding.detail ? `  ${finding.detail}` : ""}`)
  }
  const more = group.findings.length - SHOWN_PER_GROUP
  if (more > 0) console.log(`    … ${count(more)} more`)
}
console.log(
  `\n${count(errors)} errors, ${count(warnings)} warnings${
    SHOWN_PER_GROUP === Infinity || groups.length === 0 ? "" : " (all: npm run i18n:check -- --all)"
  }`
)
process.exit(errors > 0 ? 1 : 0)
