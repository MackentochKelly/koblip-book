import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, businesses } from "@/lib/db/schema"
import { saveRefund } from "@/lib/online-payment-events"
import { refundCardPayment } from "@/lib/stripe-connect"
import type { ActionResult } from "../types"

// Gives back everything a booking's card payment still holds, on the
// business's own Stripe account (docs/plans/online-payments.md, ON10).
// The caller has already checked the business is the asker's. Asking
// twice is one refund: Stripe gets the same key, and a payment Stripe
// says is already refunded is only saved as such.
// "nothing": no card payment, or all of it was given back already.
export async function refundBookingPayment(
  businessId: string,
  bookingId: string
): Promise<ActionResult<{ refundedMinor: number }>> {
  const [booking] = await db
    .select({
      paidOnlineMinor: bookings.paidOnlineMinor,
      refundedMinor: bookings.refundedMinor,
      stripePaymentId: bookings.stripePaymentId,
      stripeAccountId: businesses.stripeAccountId,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, businessId)))
    .limit(1)
  if (!booking) return { ok: false, error: "not_found" }
  const { paidOnlineMinor, stripePaymentId, stripeAccountId } = booking
  if (
    paidOnlineMinor === null ||
    !stripePaymentId ||
    !stripeAccountId ||
    paidOnlineMinor - (booking.refundedMinor ?? 0) <= 0
  )
    return { ok: false, error: "nothing" }
  try {
    const refund = await refundCardPayment(
      stripeAccountId,
      stripePaymentId,
      `refund-${bookingId}`
    )
    if (!refund) return { ok: false, error: "failed" }
  } catch (error) {
    // Given back in Stripe's own dashboard meanwhile: the same end.
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null
    if (code !== "charge_already_refunded") {
      console.error("Couldn't refund a card payment", error)
      return { ok: false, error: "failed" }
    }
  }
  await saveRefund({
    paymentId: stripePaymentId,
    refundedMinor: paidOnlineMinor,
    stripeAccountId,
  })
  return { ok: true, refundedMinor: paidOnlineMinor }
}
