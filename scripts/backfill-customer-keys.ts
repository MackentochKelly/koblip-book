import { createRequire } from "node:module"
import { eq, isNull } from "drizzle-orm"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { saveAll } = await import("../lib/db/save-all")
const { bookings } = await import("../lib/db/schema")
const { customerKey } = await import("../lib/customer-key")

// Fills customer_key on bookings made before it existed, 500 at a time.
// Safe to run again: it only touches bookings that have none.
let filled = 0
for (;;) {
  const rows = await db
    .select({
      id: bookings.id,
      name: bookings.customerName,
      phone: bookings.customerPhone,
    })
    .from(bookings)
    .where(isNull(bookings.customerKey))
    .limit(500)
  if (rows.length === 0) {
    break
  }
  await saveAll(
    rows.map((row) =>
      db
        .update(bookings)
        .set({ customerKey: customerKey(row.phone, row.name) })
        .where(eq(bookings.id, row.id))
    )
  )
  filled += rows.length
}
console.log(`Customer keys filled: ${filled}`)
