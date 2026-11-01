import { createRequire } from "node:module"
import { asc, eq } from "drizzle-orm"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { businesses } = await import("../lib/db/schema")
const { isMetaAiEnabled } = await import("../lib/meta-ai")
const { draftPoliciesFor, policyParts, writeMissingPolicies } =
  await import("../features/starter-catalog/api/fill-policies")
const { translateBusinessTexts } =
  await import("../features/dashboard/api/translate-business")

// Muse writes the booking policy, terms, privacy notice and key points for
// every real business (or only the slugs given) missing any of them, then
// translates them. Only missing parts are written, so owners' edits stay.
// Demo copies are skipped.
//
//   npm run policies:fill            every real business missing some
//   npm run policies:fill -- <slug>  only these
const slugs = process.argv.slice(2)

if (!isMetaAiEnabled()) {
  console.error("MODEL_API_KEY is not set")
  process.exit(1)
}

const rows = await db
  .select()
  .from(businesses)
  .where(eq(businesses.isDemo, false))
  .orderBy(asc(businesses.createdAt))
const targets = slugs.length > 0 ? rows.filter((row) => slugs.includes(row.slug)) : rows

let failed = 0
let skipped = 0
for (const business of targets) {
  const parts = await policyParts(business.id)
  if (parts.texts && parts.points) {
    skipped += 1
    continue
  }
  const policies = await draftPoliciesFor(business)
  if (!policies) {
    failed += 1
    console.log(`✗ ${business.slug}: no policies written`)
    continue
  }
  await writeMissingPolicies(business, policies, parts)
  const spanish = await translateBusinessTexts(business)
  console.log(`✓ ${business.slug}: policies written, Spanish ${spanish.ok ? "done" : "failed"}`)
}
console.log(
  `${targets.length - failed - skipped} written, ${skipped} already had them, ${failed} failed`
)
process.exit(failed > 0 ? 1 : 0)
