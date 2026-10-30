import "server-only"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, notificationSends } from "@/lib/db/schema"

// Changes one message of Activity may get, shared by the business page and
// the admin (D17, D33). Each returns the write to run, or why not, so the
// admin can save it together with its change-log entry. Callers check who
// may change it.

type Found = typeof notificationSends.$inferSelect

async function sendWithBooking(sendId: string, businessId?: string) {
  const [row] = await db
    .select({ send: notificationSends, booking: bookings })
    .from(notificationSends)
    .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
    .where(
      and(
        eq(notificationSends.id, String(sendId)),
        businessId ? eq(notificationSends.businessId, businessId) : undefined
      )
    )
    .limit(1)
  return row ?? null
}

// "Send again" on a failed message: it goes back to waiting, due now, and
// the next check sends it, once more. Not for a message whose booking is
// cancelled (unless it says so) or already started.
export async function sendAgainWrite(
  sendId: string,
  businessId?: string
): Promise<
  | { ok: true; send: Found; write: ReturnType<typeof againWrite> }
  | { ok: false; error: "not_found" | "notFailed" | "cancelled" | "late" }
> {
  const row = await sendWithBooking(sendId, businessId)
  if (!row) return { ok: false, error: "not_found" }
  if (row.send.state !== "failed") return { ok: false, error: "notFailed" }
  if (row.booking.status === "cancelled" && row.send.message !== "cancelled") {
    return { ok: false, error: "cancelled" }
  }
  if (Date.parse(row.booking.startAt) <= Date.now()) return { ok: false, error: "late" }
  return { ok: true, send: row.send, write: againWrite(row.send.id) }
}

function againWrite(id: string) {
  return db
    .update(notificationSends)
    .set({ state: "pending", reason: null, dueAt: new Date().toISOString() })
    .where(and(eq(notificationSends.id, id), eq(notificationSends.state, "failed")))
}

// Cancels a message still waiting: it is kept as not sent, with the reason
// `adminCancelled`, so the once-only rule holds and it is never planned again.
export async function cancelWaitingWrite(
  sendId: string
): Promise<
  | { ok: true; send: Found; write: ReturnType<typeof cancelWrite> }
  | { ok: false; error: "not_found" | "notWaiting" }
> {
  const row = await sendWithBooking(sendId)
  if (!row) return { ok: false, error: "not_found" }
  if (row.send.state !== "pending") return { ok: false, error: "notWaiting" }
  return { ok: true, send: row.send, write: cancelWrite(row.send.id) }
}

function cancelWrite(id: string) {
  return db
    .update(notificationSends)
    .set({ state: "skipped", reason: "adminCancelled" })
    .where(and(eq(notificationSends.id, id), eq(notificationSends.state, "pending")))
}
