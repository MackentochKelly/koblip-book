import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { backfillPlan, runBackfill } =
  await import("../lib/translations/backfill")
const { getTranslator } = await import("../lib/translations/provider")

// The translations backfill (docs/plans/translations.md, G7): Google
// translates again every text Meta made, and the gaps are filled.
//
//   npm run translations:backfill                 the dry run: counts, changes nothing
//   npm run translations:backfill -- --go         the real run, only after the owner's go on the cost
//   npm run translations:backfill -- --go --max=N at most N characters of Meta's texts this run
const USAGE =
  "Usage: npm run translations:backfill [-- --go [--max=<characters>]]"

const args = process.argv.slice(2)
const go = args.includes("--go")
const maxArg = args.find((arg) => arg.startsWith("--max="))
const maxCharacters =
  maxArg === undefined ? undefined : Number(maxArg.slice("--max=".length))
if (
  args.some((arg) => arg !== "--go" && arg !== maxArg) ||
  (maxArg !== undefined && !go) ||
  (maxCharacters !== undefined &&
    !(Number.isSafeInteger(maxCharacters) && maxCharacters > 0))
) {
  console.error(USAGE)
  process.exit(1)
}

const number = new Intl.NumberFormat("en-US")
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})
const count = (texts: number, characters: number) =>
  `${number.format(texts)} · ${number.format(characters)}`

const plan = await backfillPlan()
const table = [
  [
    "Scope",
    "Language",
    "Meta's (texts · chars)",
    "Test text",
    "Gaps",
    "Reused",
    "Can't send",
  ],
  ...plan.rows.map((row) => [
    row.scope,
    row.language,
    count(row.meta.texts, row.meta.characters),
    count(row.fake.texts, row.fake.characters),
    count(row.gaps.texts, row.gaps.characters),
    number.format(row.reused),
    number.format(row.skipped),
  ]),
]
const widths = table[0].map((_, column) =>
  Math.max(...table.map((line) => line[column].length))
)

console.log(
  go
    ? "Translations backfill"
    : "Translations backfill: dry run (nothing sent, nothing changed)"
)
console.log("")
for (const line of table) {
  console.log(
    line.map((cell, column) => cell.padEnd(widths[column])).join("  ")
  )
}
console.log("")
console.log(
  `To send: ${number.format(plan.texts)} texts, ${number.format(plan.characters)} characters`
)
console.log(
  `This month so far: ${number.format(plan.monthCharacters)} of ${number.format(plan.freeCharacters)} free (${number.format(plan.freeLeft)} left)`
)
console.log(
  `Past the free part: ${number.format(plan.paidCharacters)} characters, about ${usd.format(plan.estimatedUsd)} (${usd.format(plan.usdPerMillion)} per million, Google NMT)`
)
console.log(
  `Daily limit: ${number.format(plan.dailyBusinessCharacters)} characters a business; the busiest needs ${plan.days} day${plan.days === 1 ? "" : "s"}`
)
console.log(
  "This database only: the Mac and the live site share one Google project and its free part."
)

const translator = getTranslator()
if (!go) {
  console.log("")
  console.log(
    `The real run, only after the owner's go on the cost: npm run translations:backfill -- --go (Google ${translator?.name === "google" ? "is set up" : "isn't set up: it would refuse"})`
  )
  process.exit(0)
}

// Google only: the test translator's text would replace Meta's real words.
if (translator?.name !== "google") {
  console.error(
    "Google isn't set up (GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS in .env.local, and no TRANSLATION_PROVIDER=fake): nothing sent"
  )
  process.exit(1)
}

const result = await runBackfill({ translator, confirm: true, maxCharacters })
console.log("")
console.log(
  `Businesses in line with their English: ${result.synced.added} texts added, ${result.synced.changed} changed, ${result.synced.removed} removed`
)
console.log(
  `Waiting in the queue (the server's timer sends them): ${result.queued}`
)
console.log(
  `Meta's replaced by Google's: ${result.replaced} (${result.reused} free)`
)
console.log(
  `Still Meta's, for the next run (daily limit or --max): ${result.deferred}`
)
console.log(`Changed meanwhile, left as they are: ${result.kept}`)
console.log(
  `Google failed, still Meta's: ${result.failed}${result.error ? ` (${result.error})` : ""}`
)
console.log(`Characters sent to Google: ${number.format(result.characters)}`)
process.exit(result.failed > 0 ? 1 : 0)
