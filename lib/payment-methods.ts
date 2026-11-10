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

// What a business's booking page shows: the ways' names and whether paying
// at the visit is offered. Null while it lists none.
export async function paymentOptionsFor(
  businessId: string
): Promise<PaymentOptions | null> {
  const [methods, [business]] = await Promise.all([
    paymentMethodsFor(businessId),
    db
      .select({
        payLater: businesses.payLater,
        asksProof: businesses.paymentProof,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1),
  ])
  return paymentOptions(
    methods,
    business?.payLater ?? true,
    business?.asksProof ?? true
  )
}

// What the business's policies must say about paying right now.
export async function policyPaymentFor(business: {
  id: string
  payLater: boolean
}): Promise<PolicyPaymentState> {
  const methods = await paymentMethodsFor(business.id)
  return policyPaymentState(methods.length, business.payLater)
}
