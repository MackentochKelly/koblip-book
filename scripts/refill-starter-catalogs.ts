import { createRequire } from "node:module"
import { asc, eq } from "drizzle-orm"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { businesses } = await import("../lib/db/schema")
const { isMetaAiEnabled } = await import("../lib/meta-ai")
const { catalogSummary, draftFor, drawMemberPhoto, replaceCatalog } =
  await import("../features/starter-catalog/api/fill-catalog")
const { translateBusinessNow } =
  await import("../lib/translations/business-texts")

// Replaces the services, extras, prices and team of every real business
// (or only the slugs given) with a fresh Meta AI catalog and Muse Image
// team photos, then sends its changed texts to Google Translate. Demo copies are skipped. A business
// whose new catalog fails keeps what it had. Back up the database first.
//
//   npm run catalog:refill            every real business
//   npm run catalog:refill -- <slug>  only these
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
for (const business of targets) {
  const catalog = await draftFor(business)
  if (!catalog) {
    failed += 1
    console.log(`✗ ${business.slug}: no catalog, left as it was`)
    continue
  }
  await replaceCatalog(business, catalog)
  const { team } = await catalogSummary(business, catalog.team.role, true)
  const photos = await Promise.all(
    team.map((member) =>
      drawMemberPhoto(business, member.id, business.ownerId ?? "refill")
    )
  )
  const translated = await translateBusinessNow(business.id)
  console.log(
    `✓ ${business.slug}: ${catalog.services.length} services, ${catalog.extras.options.length} extras, ` +
      `${photos.filter(Boolean).length}/${team.length} photos, ` +
      `translations ${translated.status === "done" ? "sent to Google" : "waiting: Google not set up"}`
  )
}
console.log(`${targets.length - failed} of ${targets.length} businesses refilled`)
process.exit(failed > 0 ? 1 : 0)
