import "server-only"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { businesses, paymentMethods } from "@/lib/db/schema"
import {
  paymentOptions,
  policyPaymentState,
  type PaymentMethod,
  type PaymentOptions,
  type PolicyPaymentState,
} from "@/lib/payment-rules"
import { cardPayFor } from "@/lib/stripe-connect"

// A business's ways to be paid outside the app, in the owner's order, with
// their private details: for the owner's settings and for making a booking.
// Never send this to a booking page; that gets paymentOptionsFor.
export async function paymentMethodsFor(
  businessId: string
): Promise<PaymentMethod[]> {
  return db
    .select({
      id: paymentMethods.id,
      type: paymentMethods.type,
      name: paymentMethods.name,
      details: paymentMethods.details,
    })
    .from(paymentMethods)
    .where(eq(paymentMethods.businessId, businessId))
    .orderBy(asc(paymentMethods.position))
}

// What a business's booking page shows: the ways' names, the card when
// it takes one (lib/stripe-connect.ts), and whether paying at the visit is
// offered. Null while it has none of these.
export async function paymentOptionsFor(
  businessId: string
): Promise<PaymentOptions | null> {
  const [methods, [business]] = await Promise.all([
    paymentMethodsFor(businessId),
    db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1),
  ])
  return paymentOptions(
    methods,
    business?.payLater ?? true,
    business?.paymentProof ?? true,
    business ? await cardPayFor(business) : null
  )
}

// What the business's policies must say about paying right now. The card
// counts as one more way.
export async function policyPaymentFor(business: {
  id: string
  payLater: boolean
}): Promise<PolicyPaymentState> {
  const [methods, [row]] = await Promise.all([
    paymentMethodsFor(business.id),
    db.select().from(businesses).where(eq(businesses.id, business.id)).limit(1),
  ])
  const card = row ? await cardPayFor(row) : null
  return policyPaymentState(methods.length + (card ? 1 : 0), business.payLater)
}
