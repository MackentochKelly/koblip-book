import "server-only"
import { and, eq, inArray } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/lib/db"
import { bookings, notificationSends } from "@/lib/db/schema"

// The writes that move a booking to a new start, the same length, whoever
// moves it (the owner, or the customer from My bookings). Its waiting
// reminders and "Booking changed" message stop, and the sender sends
// "Booking changed" and new reminders for the new time (D5 in
// docs/plans/whatsapp-notifications.md).
export function moveWrites(
  booking: Pick<
    typeof bookings.$inferSelect,
    "id" | "moves" | "durationMinutes"
  >,
  startInstant: number
): BatchItem<"sqlite">[] {
  return [
    db
      .update(bookings)
      .set({
        startAt: new Date(startInstant).toISOString(),
        endAt: new Date(
          startInstant + booking.durationMinutes * 60_000
        ).toISOString(),
        moves: booking.moves + 1,
      })
      .where(eq(bookings.id, booking.id)),
    db
      .update(notificationSends)
      .set({ state: "skipped", reason: "moved" })
      .where(
        and(
          eq(notificationSends.bookingId, booking.id),
          eq(notificationSends.state, "pending"),
          inArray(notificationSends.message, ["reminder", "changed"])
        )
      ),
    // A confirmation still waiting goes with the new time, so it counts
    // as telling the customer of this move.
    db
      .update(notificationSends)
      .set({ moves: booking.moves + 1 })
      .where(
        and(
          eq(notificationSends.bookingId, booking.id),
          eq(notificationSends.state, "pending"),
          eq(notificationSends.message, "confirmed")
        )
      ),
  ]
}
