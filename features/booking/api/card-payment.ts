"use server"

import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"

import { getSession } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookingHolds, businesses } from "@/lib/db/schema"
import {
  closeCardSession,
  createCardSession,
  readCardSession,
} from "@/lib/stripe-connect"
import type { BookingConfirmation, BookingInput, BookingResult } from "../types"
import { book } from "./book"
import { confirmationOf, settleCardPayment } from "./settle-card-payment"

// Paying by card when booking (docs/plans/online-payments.md, ON7).

export type CardStart =
  // The time is held: send the customer to Stripe's page. bookingId and
  // claimToken are kept by their device first, as after any booking.
  | { status: "pay"; url: string; bookingId: string; claimToken: string | null }
  | Exclude<BookingResult, { status: "booked" }>

// Where the customer comes back to: the page they are on.
async function bookPage(slug: string): Promise<string> {
  const origin = (await headers()).get("origin") ?? process.env.BETTER_AUTH_URL
  return `${origin}/b/${encodeURIComponent(slug)}/book`
}

// Checks the booking, holds its time and makes Stripe's payment page on
// the business's account.
export async function startCardPayment(input: BookingInput): Promise<CardStart> {
  const outcome = await book(input, undefined, { kind: "hold" })
  if (outcome.status !== "held") {
    return outcome.status === "booked" ? { status: "failed" } : outcome
  }
  const { hold } = outcome
  try {
    const page = await bookPage(input.slug)
    const session = await getSession()
    const made = await createCardSession({
      accountId: hold.stripeAccountId,
      businessId: hold.businessId,
      holdId: hold.holdId,
      bookingId: hold.bookingId,
      title: hold.serviceName,
      description: hold.businessName,
      amountMinor: hold.amountMinor,
      currency: hold.currency,
      email: session && !session.isGuest ? session.email : null,
      // Stripe puts its own id where the braces are.
      successUrl: `${page}?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${page}?unpaid=${hold.holdId}`,
    })
    if (!made) throw new Error("No payment page")
    await db
      .update(bookingHolds)
      .set({ stripeSessionId: made.id })
      .where(eq(bookingHolds.id, hold.holdId))
    return {
      status: "pay",
      url: made.url,
      bookingId: hold.bookingId,
      claimToken: hold.claimToken,
    }
  } catch (error) {
    console.error("Couldn't make the payment page", error)
    // No page to pay on: the time is free again.
    await db.delete(bookingHolds).where(eq(bookingHolds.id, hold.holdId))
    return { status: "failed" }
  }
}

export type CardFinish =
  | { status: "booked"; booking: BookingConfirmation }
  // Not paid (yet): the customer can try again.
  | { status: "unpaid" }
  // Paid but it could not be booked: the money went back.
  | { status: "refunded" }
  | { status: "failed" }

// The customer is back from Stripe with its payment page's id. Stripe is
// asked what happened; the id alone proves nothing.
export async function finishCardPayment(
  slug: string,
  sessionId: string
): Promise<CardFinish> {
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId))
    return { status: "failed" }
  const [business] = await db
    .select({ id: businesses.id, accountId: businesses.stripeAccountId })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business?.accountId) return { status: "failed" }
  const session = await readCardSession(business.accountId, sessionId)
  if (!session || session.metadata?.businessId !== business.id)
    return { status: "failed" }
  const settled = await settleCardPayment(business.accountId, session)
  if (settled.status !== "booked") return settled
  const booking = await confirmationOf(settled.bookingId)
  return booking ? { status: "booked", booking } : { status: "failed" }
}

// The customer left Stripe's page without paying: its page is closed and
// the time is free again. Only the hold's own id (from the address Stripe
// sent them back to) frees it.
export async function cancelCardPayment(
  slug: string,
  holdId: string
): Promise<void> {
  if (typeof holdId !== "string") return
  const [row] = await db
    .select({
      sessionId: bookingHolds.stripeSessionId,
      accountId: businesses.stripeAccountId,
    })
    .from(bookingHolds)
    .innerJoin(businesses, eq(bookingHolds.businessId, businesses.id))
    .where(and(eq(bookingHolds.id, holdId), eq(businesses.slug, slug)))
    .limit(1)
  if (!row) return
  if (row.sessionId && row.accountId) {
    // Closed first, so it cannot be paid once the time is gone. If it was
    // paid a moment ago, closing fails and the hold stays for its booking.
    const session = await readCardSession(row.accountId, row.sessionId)
    if (session?.payment_status === "paid") return
    await closeCardSession(row.accountId, row.sessionId)
  }
  await db.delete(bookingHolds).where(eq(bookingHolds.id, holdId))
}
