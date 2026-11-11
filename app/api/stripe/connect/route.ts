import { eq } from "drizzle-orm"
import type Stripe from "stripe"

import {
  releaseCardHold,
  settleCardPayment,
} from "@/features/booking/api/settle-card-payment"
import { db } from "@/lib/db"
import { bookings, businesses } from "@/lib/db/schema"
import { recordPaymentEvent, saveRefund } from "@/lib/online-payment-events"
import { fromStripeAmount } from "@/lib/payment-rules"
import { saveStripeAccount, stripeConnect } from "@/lib/stripe-connect"

// Stripe tells the app what happened on the businesses' own Stripe
// accounts (docs/online-payments.md): the "Connected accounts" webhook,
// with its own secret, not the subscriptions one. Every event is checked
// against Stripe's signature first. What it does is safe to do twice;
// Stripe sends an event again until it gets a 2xx.

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null)

async function businessOfAccount(accountId: string) {
  const [business] = await db
    .select({ id: businesses.id, chargesOn: businesses.stripeChargesOn })
    .from(businesses)
    .where(eq(businesses.stripeAccountId, accountId))
    .limit(1)
  return business ?? null
}

async function handle(event: Stripe.Event, accountId: string) {
  switch (event.type) {
    // Paid (at once, or a little later for a way to pay that confirms
    // late): the held time becomes its booking.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const settled = await settleCardPayment(accountId, event.data.object)
      if (settled.status === "failed") throw new Error("Not settled")
      return
    }
    // Not paid: the time is free again.
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object
      await releaseCardHold(session.id)
      await recordPaymentEvent({
        key: event.id,
        kind: event.type === "checkout.session.expired" ? "expired" : "failed",
        businessId: (await businessOfAccount(accountId))?.id ?? null,
        stripeAccountId: accountId,
        amountMinor: fromStripeAmount(
          session.amount_total ?? 0,
          session.currency ?? ""
        ),
        currency: (session.currency ?? "").toUpperCase(),
      })
      return
    }
    // Given back, here or in Stripe's own dashboard.
    case "charge.refunded": {
      const charge = event.data.object
      const paymentId = idOf(charge.payment_intent)
      if (!paymentId) return
      await saveRefund({
        paymentId,
        refundedMinor: fromStripeAmount(charge.amount_refunded, charge.currency),
        stripeAccountId: accountId,
      })
      return
    }
    // The customer's bank took the payment back. It is between the
    // business and Stripe (ON2); the app only shows it.
    case "charge.dispute.created": {
      const dispute = event.data.object
      const paymentId = idOf(dispute.payment_intent)
      const [booking] = paymentId
        ? await db
            .select({ id: bookings.id, businessId: bookings.businessId })
            .from(bookings)
            .where(eq(bookings.stripePaymentId, paymentId))
            .limit(1)
        : []
      await recordPaymentEvent({
        key: event.id,
        kind: "disputed",
        businessId:
          booking?.businessId ?? (await businessOfAccount(accountId))?.id ?? null,
        bookingId: booking?.id ?? null,
        stripeAccountId: accountId,
        amountMinor: fromStripeAmount(dispute.amount, dispute.currency),
        currency: dispute.currency.toUpperCase(),
        note: dispute.reason,
      })
      return
    }
    // Stripe changed what the account can do: only its answer turns card
    // payments on or off for a business.
    case "account.updated": {
      const business = await businessOfAccount(accountId)
      if (!business) return
      const { chargesOn } = await saveStripeAccount(
        business.id,
        event.data.object
      )
      if (chargesOn !== business.chargesOn)
        await recordPaymentEvent({
          key: event.id,
          kind: "account",
          businessId: business.id,
          stripeAccountId: accountId,
          note: chargesOn ? "can take payments" : "cannot take payments",
        })
      return
    }
  }
}

export async function POST(request: Request) {
  if (!stripeConnect) return new Response("Online payments are off", { status: 503 })
  const signature = request.headers.get("stripe-signature")
  if (!signature) return new Response("No signature", { status: 400 })
  let event: Stripe.Event
  try {
    // The body exactly as sent: the signature is over its bytes.
    event = await stripeConnect.client.webhooks.constructEventAsync(
      await request.text(),
      signature,
      stripeConnect.webhookSecret
    )
  } catch {
    return new Response("Bad signature", { status: 400 })
  }
  // Only events from a business's account belong here.
  if (!event.account) return Response.json({ received: true })
  try {
    await handle(event, event.account)
  } catch (error) {
    console.error("Stripe event not handled", event.type, error)
    // Stripe sends it again.
    return new Response("Not handled", { status: 500 })
  }
  return Response.json({ received: true })
}
