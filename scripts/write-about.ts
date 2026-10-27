import { createRequire } from "node:module"
import { asc, eq } from "drizzle-orm"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { businessHours, businesses } = await import("../lib/db/schema")
const { writeAbout } =
  await import("../features/place-import/api/write-about")

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const slug = process.argv[2]
if (!slug) {
  console.error("Usage: npm run about:write -- <slug>")
  process.exit(1)
}

const [business] = await db
  .select()
  .from(businesses)
  .where(eq(businesses.slug, slug))
  .limit(1)

if (!business || business.description) {
  console.log("No About written")
  process.exit(0)
}

const hours = await db
  .select()
  .from(businessHours)
  .where(eq(businessHours.businessId, business.id))
  .orderBy(asc(businessHours.weekday))

const openingDays = [...new Set(hours.map((row) => row.weekday))]
  .sort((a, b) => a - b)
  .map((weekday) => WEEKDAY_SHORT[weekday])

const about = await writeAbout({
  name: business.name,
  category: business.category,
  address: business.address,
  openingDays,
})

if (!about) {
  console.log("No About written")
  process.exit(0)
}

await db
  .update(businesses)
  .set({ description: about })
  .where(eq(businesses.id, business.id))
console.log(about)
