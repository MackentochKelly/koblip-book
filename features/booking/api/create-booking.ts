"use server"

import type { BookingInput, BookingResult } from "../types"
import { book } from "./book"

// A customer books (features/booking/api/book.ts has the rules). Paying by
// card goes through startCardPayment instead: the time is held while
// Stripe takes the payment.
// proof: the form's "file", the payment proof, where the business asks
// for it (docs/plans/payment-proof.md, PP10).
export async function createBooking(
  input: BookingInput,
  proof?: FormData
): Promise<BookingResult> {
  const outcome = await book(input, proof, { kind: "book" })
  return outcome.status === "held" ? { status: "failed" } : outcome
}
