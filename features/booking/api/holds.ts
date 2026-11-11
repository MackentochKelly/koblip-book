import "server-only"
import { and, eq, gt, lte, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookingHolds } from "@/lib/db/schema"

// Times held while a customer pays by card (docs/plans/online-payments.md,
// ON7). A hold keeps its time busy like a booking does, for everyone who
// looks for a free time: customers, the owner, the assistant.

// The times held at a business right now, but `exceptHoldId` (the hold
// being turned into its booking).
export async function heldTimes(
  businessId: string,
  exceptHoldId?: string
): Promise<
  Array<{ startAt: string; endAt: string; teamMemberId: string | null }>
> {
  return db
    .select({
      startAt: bookingHolds.startAt,
      endAt: bookingHolds.endAt,
      teamMemberId: bookingHolds.teamMemberId,
    })
    .from(bookingHolds)
    .where(
      and(
        eq(bookingHolds.businessId, businessId),
        gt(bookingHolds.expiresAt, new Date(Date.now()).toISOString()),
        exceptHoldId ? ne(bookingHolds.id, exceptHoldId) : undefined
      )
    )
}

// Deletes the holds nobody paid for in time; their times are free again.
// Returns how many.
export async function deleteExpiredHolds(now = Date.now()): Promise<number> {
  const gone = await db
    .delete(bookingHolds)
    .where(lte(bookingHolds.expiresAt, new Date(now).toISOString()))
    .returning({ id: bookingHolds.id })
  return gone.length
}
