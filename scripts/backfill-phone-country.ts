import { createRequire } from "node:module"
import { and, eq, isNotNull, not, like } from "drizzle-orm"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { bookings, businesses, customers } = await import("../lib/db/schema")
const { customerKey } = await import("../lib/customer-key")
const { internationalPhone } = await import("../lib/whatsapp-phone")

// Numbers saved before the country picker get their country code, from their
// business's country, so a customer stays one customer under the new key.
// Safe to run again: it only touches numbers with no "+". A hand-added
// customer whose new key already exists keeps its row as it is.
const rows = await db
  .select({ id: bookings.id, name: bookings.customerName, phone: bookings.customerPhone, business: businesses })
  .from(bookings)
  .innerJoin(businesses, eq(businesses.id, bookings.businessId))
  .where(and(isNotNull(bookings.customerPhone), not(like(bookings.customerPhone, "+%"))))
for (const row of rows) {
  const phone = internationalPhone(row.phone!, row.business)
  await db
    .update(bookings)
    .set({ customerPhone: phone, customerKey: customerKey(phone, row.name) })
    .where(eq(bookings.id, row.id))
}
const people = await db
  .select({ id: customers.id, name: customers.name, phone: customers.phone, business: businesses })
  .from(customers)
  .innerJoin(businesses, eq(businesses.id, customers.businessId))
  .where(and(isNotNull(customers.phone), not(like(customers.phone, "+%"))))
let kept = 0
for (const person of people) {
  const phone = internationalPhone(person.phone!, person.business)
  await db
    .update(customers)
    .set({ phone, customerKey: customerKey(phone, person.name) })
    .where(eq(customers.id, person.id))
    .catch(() => {
      kept += 1
    })
}
console.log(`Bookings: ${rows.length}. Customers: ${people.length - kept}, kept as they were: ${kept}.`)
