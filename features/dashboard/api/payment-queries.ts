import "server-only"
import { and, count, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { paymentMethodsFor } from "@/lib/payment-methods"
import { hasFeature } from "@/lib/plan-access"
import {
  onlinePayOf,
  type OnlinePay,
  type PaymentMethod,
} from "@/lib/payment-rules"
import { type StripeState, stripeStateOf } from "@/lib/stripe-connect"
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

export interface OnlinePaySettings {
  // The business's plan has online payments.
  available: boolean
  // Where its own Stripe account stands.
  stripe: StripeState
  // What customers pay by card when they book; null when off.
  pay: OnlinePay | null
  currency: string
}

// The signed-in owner's online payments (docs/plans/online-payments.md):
// the Stripe account's state and the card setting.
export async function getOnlinePaySettings(
  businessId: string
): Promise<OnlinePaySettings> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    notFound()
  }
  return {
    available:
      !owned.business.isDemo &&
      (await hasFeature(owned.business.id, "onlinePayments")),
    stripe: stripeStateOf(owned.business),
    pay: onlinePayOf(owned.business),
    currency: owned.business.currency,
  }
}
