import { createRequire } from "node:module"
import { and, eq, isNotNull } from "drizzle-orm"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { businesses } = await import("../lib/db/schema")
const { fetchPlace } = await import("../features/place-import/api/fetch-place")
const { writeAbout } =
  await import("../features/place-import/api/write-about")
const { googleCategory, specificTypes } =
  await import("../features/place-import/utils/map-place")

// Businesses saved before S7 kept Google's catch-all category ("Services").
// For each one still showing what Google gave, asks Google for its type
// again and, when it is a catch-all, has Muse name the category. Only the
// category changes. Prints what it would do; --apply saves.
const apply = process.argv.includes("--apply")

const rows = await db
  .select({
    id: businesses.id,
    slug: businesses.slug,
    name: businesses.name,
    address: businesses.address,
    website: businesses.website,
    category: businesses.category,
    googlePlaceId: businesses.googlePlaceId,
  })
  .from(businesses)
  .where(isNotNull(businesses.googlePlaceId))

let fixed = 0
for (const row of rows) {
  if (!row.googlePlaceId) continue
  let place
  try {
    place = await fetchPlace(row.googlePlaceId)
  } catch (error) {
    console.error(`${row.slug}: Google failed (${String(error)})`)
    continue
  }
  // Only what Google gave is replaced, and only a catch-all.
  const google = place.primaryTypeDisplayName?.text ?? null
  if (googleCategory(place) !== null || row.category !== google) continue
  const words = await writeAbout({
    name: row.name,
    address: row.address,
    website: row.website,
    placeTypes: specificTypes(place),
    nameCategory: true,
  })
  const category = words?.category ?? null
  console.log(`${row.slug}: ${row.category ?? "none"} → ${category ?? "none"}`)
  if (apply) {
    await db
      .update(businesses)
      .set({ category })
      .where(
        and(
          eq(businesses.id, row.id),
          row.category === null
            ? undefined
            : eq(businesses.category, row.category)
        )
      )
  }
  fixed += 1
}

console.log(
  apply
    ? `Saved ${fixed} categories.`
    : `${fixed} to fix. Run again with --apply to save.`
)
