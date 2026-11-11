import "server-only"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { bookings, onlinePaymentEvents } from "@/lib/db/schema"
import { clientNotification } from "@/lib/in-app-notifications"
import { paidInFullOnline } from "@/lib/payment-rules"

// What happened to online payments (docs/plans/online-payments.md): the
// admin's history, and the guard that handles one Stripe event once.
export const ONLINE_PAYMENT_KINDS = [
  // A card paid and its booking was made.
  "paid",
  // A card paid but the booking could not be made: given back at once (ON8).
  "refunded_unbookable",
  // The owner gave a payment back (ON10), or Stripe says one was.
  "refunded",
  // The customer's bank took a payment back.
  "disputed",
  // A payment page closed unpaid; its held time is free again.
  "expired",
  "failed",
  // Stripe changed what a business's account can do.
  "account",
] as const
export type OnlinePaymentKind = (typeof ONLINE_PAYMENT_KINDS)[number]

// Records one thing that happened. False when `key` was recorded before:
// the caller then does nothing more (Stripe sends an event again until it
// is answered, and sometimes twice).
export async function recordPaymentEvent(event: {
  key: string
  kind: OnlinePaymentKind
  businessId?: string | null
  bookingId?: string | null
  stripeAccountId?: string | null
  amountMinor?: number | null
  currency?: string | null
  note?: string | null
}): Promise<boolean> {
  const saved = await db
    .insert(onlinePaymentEvents)
    .values(event)
    .onConflictDoNothing({ target: onlinePaymentEvents.key })
    .returning({ id: onlinePaymentEvents.id })
  return saved.length > 0
}

// Saves on its booking that a card payment was given back, in part or in
// full: `refundedMinor` is everything given back so far, as Stripe counts
// it. Called by the owner's Refund and by Stripe's `charge.refunded`, so
// a refund made in Stripe's own dashboard shows too; the same amount twice
// changes nothing. A booking no longer paid in full is "not paid" again.
// Returns the booking, or null when no booking has that payment.
export async function saveRefund(input: {
  paymentId: string
  refundedMinor: number
  stripeAccountId: string
}): Promise<{ id: string; businessId: string; isNew: boolean } | null> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.stripePaymentId, input.paymentId))
    .limit(1)
  if (!booking || booking.paidOnlineMinor === null) return null
  const refundedMinor = Math.min(booking.paidOnlineMinor, input.refundedMinor)
  const isNew = await recordPaymentEvent({
    key: `refund:${input.paymentId}:${refundedMinor}`,
    kind: "refunded",
    businessId: booking.businessId,
    bookingId: booking.id,
    stripeAccountId: input.stripeAccountId,
    amountMinor: refundedMinor,
    currency: booking.currency,
  })
  if (refundedMinor <= (booking.refundedMinor ?? 0)) {
    return { id: booking.id, businessId: booking.businessId, isNew: false }
  }
  const stillPaid =
    booking.paymentStatus === "paid" &&
    paidInFullOnline(booking.priceMinor, {
      paidMinor: booking.paidOnlineMinor,
      refundedMinor,
    })
  // The customer's bell hears of it, saved with the refund.
  await saveAll([
    db
      .update(bookings)
      .set({
        refundedMinor,
        refundedAt: new Date(Date.now()).toISOString(),
        ...(booking.paymentStatus === "paid" && !stillPaid
          ? { paymentStatus: "unpaid" as const, paymentPaidAt: null }
          : {}),
      })
      .where(eq(bookings.id, booking.id)),
    ...(await clientNotification(booking, "clientRefunded")),
  ])
  return { id: booking.id, businessId: booking.businessId, isNew }
}
