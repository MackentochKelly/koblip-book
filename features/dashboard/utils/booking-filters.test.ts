import { expect, test } from "vitest"
import type { OwnerBooking } from "../types"
import {
  bookingActions,
  bookingState,
  byStatus,
  matchBookings,
  statusCounts,
} from "./booking-filters"

const now = "2026-10-31T12:00:00.000Z"

const booking = (over: Partial<OwnerBooking>): OwnerBooking =>
  ({
    id: "b",
    status: "confirmed",
    startAt: "2026-11-01T10:00:00.000Z",
    endAt: "2026-11-01T10:30:00.000Z",
    customerName: "Ana Diaz",
    customerPhone: "+1 809 555 0101",
    serviceId: "s1",
    serviceName: "Skin Fade",
    teamMemberId: "t1",
    teamMemberName: "Steve",
    addons: [],
    ...over,
  }) as OwnerBooking

const rows = [
  booking({ id: "future" }),
  booking({
    id: "ended",
    startAt: "2026-10-30T10:00:00.000Z",
    endAt: "2026-10-30T10:30:00.000Z",
    customerName: "Luis Gomez",
    serviceId: "s2",
    serviceName: "Beard Trim",
    teamMemberId: "t2",
    teamMemberName: "Kelly",
  }),
  booking({ id: "done", status: "completed", endAt: "2026-10-29T10:30:00.000Z" }),
  booking({ id: "gone", status: "cancelled" }),
]

test("a booked one is upcoming until it ends, then not marked", () => {
  expect(bookingState(rows[0], now)).toBe("upcoming")
  expect(bookingState(rows[1], now)).toBe("unmarked")
  expect(bookingState(rows[2], now)).toBe("completed")
})

test("each status tab counts its bookings", () => {
  expect(statusCounts(rows, now)).toEqual({
    all: 4,
    upcoming: 1,
    unmarked: 1,
    completed: 1,
    no_show: 0,
    cancelled: 1,
  })
  expect(byStatus(rows, "unmarked", now).map((row) => row.id)).toEqual([
    "ended",
  ])
})

test("search matches names, service and phone digits; filters narrow", () => {
  const none = { serviceIds: [], teamIds: [] }
  expect(matchBookings(rows, { ...none, search: "luis beard" })).toHaveLength(1)
  expect(matchBookings(rows, { ...none, search: "555 0101" })).toHaveLength(4)
  expect(
    matchBookings(rows, { search: "", serviceIds: ["s2"], teamIds: [] })
  ).toHaveLength(1)
  expect(
    matchBookings(rows, { search: "", serviceIds: [], teamIds: ["t1"] })
  ).toHaveLength(3)
})

test("what can be done depends on the time and status", () => {
  expect(bookingActions(rows[0], now)).toEqual(["move", "cancel"])
  expect(bookingActions(rows[1], now)).toEqual(["done", "noShow"])
  expect(bookingActions(rows[2], now)).toEqual(["undo"])
  expect(bookingActions(rows[3], now)).toEqual([])
})
