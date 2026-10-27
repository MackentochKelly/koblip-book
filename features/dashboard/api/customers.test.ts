// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ notFound: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { buildCustomers, customerKey } = await import("./customers")

const TZ = "America/Santo_Domingo"
// Monday 2026-06-01 08:00 local.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

test("customerKey ignores phone formatting", () => {
  expect(customerKey("+1 (555) 010-0000", "Luis")).toBe(
    customerKey("15550100000", "Someone Else")
  )
  expect(customerKey("+1 (555) 010-0000", "Luis")).toBe("p:15550100000")
})

test("customerKey falls back to the normalized name", () => {
  expect(customerKey(null, "  Luis   Perez ")).toBe("n:luis perez")
  expect(customerKey("", "Ana")).toBe("n:ana")
  expect(customerKey(null, "ANA")).toBe("n:ana")
})

test("buildCustomers counts, totals and dates per customer", () => {
  const customers = buildCustomers(
    [
      {
        customerName: "Luis",
        customerPhone: "+1 (555) 010-0000",
        status: "completed",
        startAt: "2020-03-01T14:00:00.000Z",
        priceMinor: 1000,
      },
      {
        customerName: "Luis P",
        customerPhone: "15550100000",
        status: "completed",
        startAt: "2020-06-01T14:00:00.000Z",
        priceMinor: 2000,
      },
      {
        customerName: "Luis P",
        customerPhone: "15550100000",
        status: "no_show",
        startAt: "2020-07-01T14:00:00.000Z",
        priceMinor: 2000,
      },
      {
        customerName: "Luis P",
        customerPhone: "+15550100000",
        status: "cancelled",
        startAt: "2020-08-01T14:00:00.000Z",
        priceMinor: 2000,
      },
      {
        customerName: "Luis P",
        customerPhone: "+15550100000",
        status: "confirmed",
        startAt: "2099-06-01T14:00:00.000Z",
        priceMinor: 5000,
      },
      {
        customerName: "Ana",
        customerPhone: null,
        status: "completed",
        startAt: "2020-05-01T14:00:00.000Z",
        priceMinor: null,
      },
    ],
    NOW,
    TZ,
    "DOP"
  )
  expect(customers).toHaveLength(2)
  const [luis, ana] = customers
  // Next booking first.
  expect(luis.key).toBe("p:15550100000")
  expect(luis).toMatchObject({
    name: "Luis P",
    phone: "+15550100000",
    bookings: 5,
    completed: 2,
    noShows: 1,
    cancelled: 1,
    lastVisit: "2020-06-01",
    nextBooking: "2099-06-01",
    spentMinor: 3000,
    currency: "DOP",
  })
  expect(ana).toMatchObject({
    key: "n:ana",
    name: "Ana",
    phone: null,
    bookings: 1,
    completed: 1,
    noShows: 0,
    cancelled: 0,
    lastVisit: "2020-05-01",
    nextBooking: null,
    spentMinor: 0,
  })
})

test("customers without a next booking order by latest activity", () => {
  const customers = buildCustomers(
    [
      {
        customerName: "Old",
        customerPhone: null,
        status: "completed",
        startAt: "2020-01-01T14:00:00.000Z",
        priceMinor: 100,
      },
      {
        customerName: "New",
        customerPhone: null,
        status: "cancelled",
        startAt: "2021-01-01T14:00:00.000Z",
        priceMinor: 100,
      },
    ],
    NOW,
    TZ,
    "DOP"
  )
  expect(customers.map((customer) => customer.key)).toEqual([
    "n:new",
    "n:old",
  ])
  expect(customers[0].lastVisit).toBeNull()
  expect(customers[1].lastVisit).toBe("2020-01-01")
})
