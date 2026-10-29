// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"
import { customerKey } from "@/lib/customer-key"
import { bookings, businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ notFound: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { getCustomerBookings, getCustomers } = await import("./customers")

// Monday 2026-06-01 08:00 in Santo Domingo.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let dir: string
let closeDb: () => void
let count = 0

async function book(
  customerName: string,
  customerPhone: string | null,
  status: string,
  startAt: string,
  priceMinor: number | null = 1000
) {
  const { db } = await import("@/lib/db")
  count += 1
  await db.insert(bookings).values({
    id: `bk-${count}`,
    businessId: "b1",
    serviceName: "Cut",
    durationMinutes: 30,
    priceMinor,
    currency: "DOP",
    startAt,
    endAt: startAt,
    customerName,
    customerPhone,
    customerKey: customerKey(customerPhone, customerName),
    status,
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-customers-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: true,
  })
  await db.insert(businesses).values({
    id: "b1",
    slug: "b1",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(async () => {
  vi.restoreAllMocks()
  const { db } = await import("@/lib/db")
  await db.delete(bookings)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

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

test("counts, totals and dates per customer", async () => {
  await book(
    "Luis",
    "+1 (555) 010-0000",
    "completed",
    "2020-03-01T14:00:00.000Z",
    1000
  )
  await book(
    "Luis P",
    "15550100000",
    "completed",
    "2020-06-01T14:00:00.000Z",
    2000
  )
  await book(
    "Luis P",
    "15550100000",
    "no_show",
    "2020-07-01T14:00:00.000Z",
    2000
  )
  await book(
    "Luis P",
    "+15550100000",
    "cancelled",
    "2020-08-01T14:00:00.000Z",
    2000
  )
  await book(
    "Luis P",
    "+15550100000",
    "confirmed",
    "2099-06-01T14:00:00.000Z",
    5000
  )
  await book("Ana", null, "completed", "2020-05-01T14:00:00.000Z", null)

  const customers = await getCustomers("b1")

  expect(customers).toHaveLength(2)
  const [luis, ana] = customers
  // Next booking first.
  expect(luis).toEqual({
    key: "p:15550100000",
    name: "Luis P",
    phone: "+15550100000",
    bookings: 5,
    completed: 2,
    noShows: 1,
    cancelled: 1,
    lastVisit: "2020-06-01",
    firstBooking: "2020-03-01",
    nextBooking: "2099-06-01",
    spentMinor: 3000,
    currency: "DOP",
  })
  expect(ana).toEqual({
    key: "n:ana",
    name: "Ana",
    phone: null,
    bookings: 1,
    completed: 1,
    noShows: 0,
    cancelled: 0,
    lastVisit: "2020-05-01",
    firstBooking: "2020-05-01",
    nextBooking: null,
    spentMinor: 0,
    currency: "DOP",
  })
})

test("firstBooking is the earliest booking of any status", async () => {
  await book("Luis", "+15550100000", "cancelled", "2020-01-15T14:00:00.000Z")
  await book("Luis", "+15550100000", "completed", "2020-06-01T14:00:00.000Z")

  const customers = await getCustomers("b1")

  expect(customers).toHaveLength(1)
  expect(customers[0].firstBooking).toBe("2020-01-15")
  expect(customers[0].lastVisit).toBe("2020-06-01")
})

test("a booking that already started is not the next one", async () => {
  await book("Luis", "+15550100000", "confirmed", "2026-06-01T11:00:00.000Z")

  const [luis] = await getCustomers("b1")

  expect(luis.nextBooking).toBeNull()
})

test("customers without a next booking order by latest activity", async () => {
  await book("Old", null, "completed", "2020-01-01T14:00:00.000Z", 100)
  await book("New", null, "cancelled", "2021-01-01T14:00:00.000Z", 100)

  const customers = await getCustomers("b1")

  expect(customers.map((customer) => customer.key)).toEqual(["n:new", "n:old"])
  expect(customers[0].lastVisit).toBeNull()
  expect(customers[1].lastVisit).toBe("2020-01-01")
})

test("at most 500 customers", async () => {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values(
    Array.from({ length: 501 }, (_, i) => ({
      id: `many-${i}`,
      businessId: "b1",
      serviceName: "Cut",
      durationMinutes: 30,
      currency: "DOP",
      startAt: "2020-01-01T14:00:00.000Z",
      endAt: "2020-01-01T14:30:00.000Z",
      customerName: `Person ${i}`,
      customerKey: customerKey(null, `Person ${i}`),
    }))
  )

  expect(await getCustomers("b1")).toHaveLength(500)
})

test("one customer's bookings, newest first, no one else's", async () => {
  await book("Luis", "+15550100000", "completed", "2020-03-01T14:00:00.000Z")
  await book("Ana", null, "completed", "2020-04-01T14:00:00.000Z")
  await book(
    "Luis P",
    "1 555 010 0000",
    "confirmed",
    "2099-06-01T14:00:00.000Z"
  )

  const list = await getCustomerBookings("b1", "p:15550100000")

  expect(list.map((booking) => booking.startAt)).toEqual([
    "2099-06-01T14:00:00.000Z",
    "2020-03-01T14:00:00.000Z",
  ])
})
