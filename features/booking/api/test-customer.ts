import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"

// The signed-in customer booking tests book as: only an account books a
// real business (docs/plans/email.md, EM-D7). Its id is CUSTOMER_ID; each
// test file adds its row once its database exists.
export const CUSTOMER_ID = "u-customer"

export async function addCustomer() {
  await db
    .insert(user)
    .values({
      id: CUSTOMER_ID,
      name: "Ana",
      email: "customer@example.test",
      emailVerified: true,
    })
    .onConflictDoNothing()
}
