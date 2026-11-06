import "server-only"
import { and, lte, notInArray, type SQL } from "drizzle-orm"

import { bookings } from "@/lib/db/schema"

// A visit that can be reviewed: over, and not cancelled or a no-show.
export function reviewable(now: Date): SQL {
  return and(
    notInArray(bookings.status, ["cancelled", "no_show"]),
    lte(bookings.endAt, now.toISOString())
  )!
}
