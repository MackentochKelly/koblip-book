import "server-only"
import { and, count, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { paymentMethodsFor } from "@/lib/payment-methods"
import type { PaymentMethod } from "@/lib/payment-rules"
import { ownedBusiness } from "./owned-business"

export interface PaymentSettings {
  // With their private instructions: the owner's own.
  methods: PaymentMethod[]
  payLater: boolean
  // Bookings whose customer says they paid, waiting for the owner.
  toCheck: number
}

// The signed-in owner's ways to be paid outside the app, and how many
// payments wait for a check (lib/payment-rules.ts).
export async function getPaymentSettings(
  businessId: string
): Promise<PaymentSettings> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    notFound()
  }
  const [methods, [waiting]] = await Promise.all([
    paymentMethodsFor(owned.business.id),
    db
      .select({ n: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, owned.business.id),
          eq(bookings.paymentStatus, "reported")
        )
      ),
  ])
  return {
    methods,
    payLater: owned.business.payLater,
    toCheck: waiting?.n ?? 0,
  }
}
