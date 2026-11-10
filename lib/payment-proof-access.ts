import "server-only"

import { and, eq } from "drizzle-orm"
import { getCustomer } from "./customer-dal"
import { customerKey } from "./customer-key"
import { getSession, isAdmin } from "./dal"
import { db } from "./db"
import { bookings, businesses, teamMembers } from "./db/schema"

// Who may open a booking's payment picture (docs/plans/payment-proof.md,
// PP2): the customer who booked, the business's owner, the team member the
// booking is with while the business lets its team see them, and an app
// admin. Gives the picture's file name, or null for everyone else and for
// a booking with none: the caller answers "not found" either way, so the
// address never tells who booked where.
export async function proofNameFor(bookingId: string): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  const [row] = await db
    .select({
      proof: bookings.paymentProof,
      teamMemberId: bookings.teamMemberId,
      customerUserId: bookings.customerUserId,
      customerKey: bookings.customerKey,
      ownerId: businesses.ownerId,
      teamSees: businesses.paymentProofTeam,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row?.proof) return null
  if (row.ownerId === session.userId) return row.proof
  const customer = await getCustomer()
  if (
    customer &&
    (row.customerUserId === customer.userId ||
      (customer.phone !== null &&
        row.customerKey === customerKey(customer.phone, "")))
  ) {
    return row.proof
  }
  if (row.teamSees && row.teamMemberId) {
    const [seat] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, row.teamMemberId),
          eq(teamMembers.userId, session.userId)
        )
      )
      .limit(1)
    if (seat) return row.proof
  }
  return (await isAdmin(session.userId)) ? row.proof : null
}
