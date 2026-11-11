import { expect, test } from "vitest"
import { OTHER_GROUP } from "@/lib/service-groups"
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
    payment: 0,
    completed: 1,
    no_show: 0,
    cancelled: 1,
  })
  expect(byStatus(rows, "unmarked", now).map((row) => row.id)).toEqual([
    "ended",
  ])
})

test("search matches names, service and phone digits; filters narrow", () => {
  const none = { categoryIds: [], serviceIds: [], teamIds: [] }
  expect(matchBookings(rows, { ...none, search: "luis beard" })).toHaveLength(1)
  expect(matchBookings(rows, { ...none, search: "555 0101" })).toHaveLength(4)
  expect(
    matchBookings(rows, { ...none, search: "", serviceIds: ["s2"] })
  ).toHaveLength(1)
  expect(
    matchBookings(rows, { ...none, search: "", teamIds: ["t1"] })
  ).toHaveLength(3)
})

test("a category filter keeps its services' bookings, Other those with none", () => {
  const none = { search: "", serviceIds: [], teamIds: [] }
  // s1 is in Hair; s2 has no category.
  const categoryOf = (row: OwnerBooking) =>
    row.serviceId === "s1" ? "hair" : null
  const ids = (categoryIds: string[]) =>
    matchBookings(rows, { ...none, categoryIds }, categoryOf).map(
      (row) => row.id
    )
  expect(ids([])).toEqual(["future", "ended", "done", "gone"])
  expect(ids(["hair"])).toEqual(["future", "done", "gone"])
  expect(ids([OTHER_GROUP])).toEqual(["ended"])
  expect(ids(["hair", OTHER_GROUP])).toHaveLength(4)
})

test("what can be done depends on the time and status", () => {
  expect(bookingActions(rows[0], now)).toEqual(["move", "cancel"])
  expect(bookingActions(rows[1], now)).toEqual(["done", "noShow"])
  expect(bookingActions(rows[2], now)).toEqual(["undo"])
  expect(bookingActions(rows[3], now)).toEqual([])
})

test("Review payment holds only what a customer says they paid", () => {
  const zelle = { type: "zelle" as const, name: "Zelle", details: "x" }
  const pay = (id: string, status: "unpaid" | "reported" | "paid") =>
    booking({
      id,
      payment: {
        choice: "now",
        method: zelle,
        status,
        reference: null,
        hasProof: false,
        online: null,
      },
    })
  const list = [pay("a", "unpaid"), pay("b", "reported"), pay("c", "paid"), booking({ id: "d" })]
  expect(statusCounts(list, now).payment).toBe(1)
  expect(byStatus(list, "payment", now).map((row) => row.id)).toEqual(["b"])
})
