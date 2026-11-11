import "server-only"
import { asc, eq } from "drizzle-orm"
import type Stripe from "stripe"

import { db } from "@/lib/db"
import {
  bookingAddons,
  bookingHolds,
  bookings,
  businesses,
} from "@/lib/db/schema"
import { recordPaymentEvent } from "@/lib/online-payment-events"
import { fromStripeAmount, paymentOf } from "@/lib/payment-rules"
import { refundCardPayment } from "@/lib/stripe-connect"
import type { BookingConfirmation, BookingInput } from "../types"
import { book } from "./book"

// What became of a card payment.
export type CardSettled =
  // The booking exists (made now, or already made by the other caller).
  | { status: "booked"; bookingId: string }
  // Stripe has no payment yet.
  | { status: "unpaid" }
  // Paid, but the booking could not be made: the money was given back.
  | { status: "refunded" }
  | { status: "failed" }

async function bookingOfSession(sessionId: string) {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.stripeSessionId, sessionId))
    .limit(1)
  return row ?? null
}

// Turns what Stripe says about a payment page into the booking (ON7, ON9).
// The one place a booking becomes "paid online": Stripe's webhook and the
// page the customer comes back to both call it, with a session that came
// from Stripe itself (a signed event, or read from Stripe by id), never
// from the browser. Safe to call twice: the session id is on one booking
// at most, and the hold is turned into its booking once.
export async function settleCardPayment(
  accountId: string,
  session: Stripe.Checkout.Session
): Promise<CardSettled> {
  try {
    const made = await bookingOfSession(session.id)
    if (made) return { status: "booked", bookingId: made.id }
    if (session.payment_status !== "paid") return { status: "unpaid" }

    const paymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null)
    const currency = (session.currency ?? "").toUpperCase()
    const paidMinor = fromStripeAmount(session.amount_total ?? 0, currency)
    const [hold] = await db
      .select()
      .from(bookingHolds)
      .where(eq(bookingHolds.stripeSessionId, session.id))
      .limit(1)
    if (hold) {
      const outcome = await book(hold.input as unknown as BookingInput, undefined, {
        kind: "paid",
        hold,
        paidMinor,
        sessionId: session.id,
        paymentId,
      })
      if (outcome.status === "booked") {
        await recordPaymentEvent({
          key: `paid:${session.id}`,
          kind: "paid",
          businessId: hold.businessId,
          bookingId: outcome.booking.id,
          stripeAccountId: accountId,
          amountMinor: paidMinor,
          currency,
        })
        return { status: "booked", bookingId: outcome.booking.id }
      }
      // The other caller may have made it a moment before.
      const meanwhile = await bookingOfSession(session.id)
      if (meanwhile) return { status: "booked", bookingId: meanwhile.id }
    }
    // Paid, and no booking can be made (ON8): the money goes back at once.
    if (!paymentId) return { status: "failed" }
    await refundCardPayment(accountId, paymentId, `unbookable-${session.id}`)
    if (hold)
      await db.delete(bookingHolds).where(eq(bookingHolds.id, hold.id))
    await recordPaymentEvent({
      key: `unbookable:${session.id}`,
      kind: "refunded_unbookable",
      businessId: hold?.businessId ?? session.metadata?.businessId ?? null,
      stripeAccountId: accountId,
      amountMinor: paidMinor,
      currency,
    })
    return { status: "refunded" }
  } catch (error) {
    console.error("Couldn't settle a card payment", error)
    return { status: "failed" }
  }
}

// A payment page that closed unpaid: its held time is free again.
export async function releaseCardHold(sessionId: string): Promise<void> {
  await db
    .delete(bookingHolds)
    .where(eq(bookingHolds.stripeSessionId, sessionId))
}

// The wall-clock date and time of an instant in a zone.
function zoned(iso: string, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value])
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

// A booking as its "You're booked" screen shows it, for the customer
// coming back from Stripe.
export async function confirmationOf(
  bookingId: string
): Promise<BookingConfirmation | null> {
  const [row] = await db
    .select({ booking: bookings, business: businesses })
    .from(bookings)
    .innerJoin(businesses, eq(bookings.businessId, businesses.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) return null
  const { booking, business } = row
  const addons = await db
    .select({
      name: bookingAddons.name,
      priceMinor: bookingAddons.priceMinor,
      durationMinutes: bookingAddons.durationMinutes,
    })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, booking.id))
    .orderBy(asc(bookingAddons.position))
  return {
    id: booking.id,
    businessName: business.name,
    address: business.address,
    timeZone: business.timezone,
    serviceName: booking.serviceName,
    teamMemberName: booking.teamMemberName,
    durationMinutes: booking.durationMinutes,
    priceMinor: booking.priceMinor,
    rewardDiscountMinor: booking.rewardDiscountMinor,
    currency: booking.currency,
    ...zoned(booking.startAt, business.timezone),
    addons,
    payment: paymentOf(booking),
  }
}
