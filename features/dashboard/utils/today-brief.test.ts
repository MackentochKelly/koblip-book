import { expect, test } from "vitest"
import type { OwnerBooking } from "../types"
import { todayBrief } from "./today-brief"

const today = "2026-10-31"
const now = "2026-10-31T15:00:00.000Z"

const booking = (over: Partial<OwnerBooking>): OwnerBooking =>
  ({
    id: "b",
    date: today,
    status: "confirmed",
    startAt: "2026-10-31T16:00:00.000Z",
    customerName: "Ana",
    ...over,
  }) as OwnerBooking

test("counts today's standing bookings once and finds the next", () => {
  const later = booking({ id: "later", startAt: "2026-10-31T18:00:00.000Z" })
  const soon = booking({ id: "soon" })
  const done = booking({ id: "done", startAt: "2026-10-31T10:00:00.000Z" })
  const brief = todayBrief(
    [later, soon, soon, done, booking({ id: "x", status: "cancelled" })],
    today,
    now
  )
  expect(brief.count).toBe(3)
  expect(brief.next?.id).toBe("soon")
})

test("leaves out other days, and has no next once today is over", () => {
  const brief = todayBrief(
    [
      booking({ id: "past", startAt: "2026-10-31T09:00:00.000Z" }),
      booking({ id: "tomorrow", date: "2026-11-01" }),
    ],
    today,
    now
  )
  expect(brief).toEqual({ count: 1, next: null })
})
