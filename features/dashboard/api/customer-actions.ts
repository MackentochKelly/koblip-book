"use server"

import { and, eq } from "drizzle-orm"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { customerKey } from "@/lib/customer-key"
import { db } from "@/lib/db"
import { bookings, customers } from "@/lib/db/schema"
import type { ActionResult } from "../types"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

// The owner adds a customer by hand: a name, and a phone if they have one.
// Someone already on the Customers page (added, or from a booking with the
// same phone or name) is refused as "exists".
export async function addCustomer(
  businessId: string,
  input: { name: string; phone: string | null }
): Promise<ActionResult<{ key: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (name.length < 1 || name.length > BOOKING_RULES.maxCustomerName) {
    return { ok: false, error: "name" }
  }
  const rawPhone = typeof input.phone === "string" ? input.phone.trim() : ""
  const phone = rawPhone === "" ? null : rawPhone
  if (phone !== null && !PHONE_PATTERN.test(phone)) {
    return { ok: false, error: "phone" }
  }
  const key = customerKey(phone, name)
  const ownerBusinessId = owned.business.id
  const [saved, booked] = await Promise.all([
    db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.businessId, ownerBusinessId), eq(customers.customerKey, key))
      )
      .limit(1),
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(eq(bookings.businessId, ownerBusinessId), eq(bookings.customerKey, key))
      )
      .limit(1),
  ])
  if (saved.length > 0 || booked.length > 0) {
    return { ok: false, error: "exists" }
  }
  await db
    .insert(customers)
    .values({ businessId: ownerBusinessId, customerKey: key, name, phone })
  revalidateBusiness(owned.business.slug)
  return { ok: true, key }
}
