import "server-only"

import { and, eq, isNotNull, lt } from "drizzle-orm"
import { db } from "./db"
import { bookings } from "./db/schema"
import { deleteProof, listProofs } from "./payment-proofs"
import { PAYMENT_RULES } from "./payment-rules"

// Deletes payment pictures that are due (docs/plans/payment-proof.md, PP5):
// - a booking's picture, proofKeepDays after the booking's date;
// - a picture no booking holds any more: its booking, business or account
//   was deleted, or it was replaced. Deleting rows anywhere in the app
//   therefore needs no code of its own to keep the store clean.
// Gives how many pictures went.
export async function sweepPaymentProofs(now: number = Date.now()): Promise<number> {
  const cutoff = new Date(
    now - PAYMENT_RULES.proofKeepDays * 86_400_000
  ).toISOString()
  const due = await db
    .select({ id: bookings.id, proof: bookings.paymentProof })
    .from(bookings)
    .where(and(isNotNull(bookings.paymentProof), lt(bookings.startAt, cutoff)))
  for (const row of due) {
    // The booking lets go first: a picture never stays reachable after
    // its file is gone.
    await db
      .update(bookings)
      .set({ paymentProof: null })
      .where(eq(bookings.id, row.id))
    await deleteProof(row.proof)
  }
  const held = new Set(
    (
      await db
        .select({ proof: bookings.paymentProof })
        .from(bookings)
        .where(isNotNull(bookings.paymentProof))
    ).map((row) => row.proof)
  )
  const oldEnough = now - PAYMENT_RULES.proofOrphanMinutes * 60_000
  let orphans = 0
  for (const file of await listProofs()) {
    if (!held.has(file.name) && file.savedAt < oldEnough) {
      await deleteProof(file.name)
      orphans += 1
    }
  }
  return due.length + orphans
}
