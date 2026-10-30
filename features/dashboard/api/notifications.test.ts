// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { customerKey } from "@/lib/customer-key"
import { bookings, businesses, notificationSends, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { notificationHistoryFor } = await import("./notifications")

let dir: string
let closeDb: () => void
let count = 0

type Send = {
  businessId?: string
  customerName: string
  customerPhone: string | null
  message: "confirmed" | "reminder" | "changed" | "cancelled"
  state: "pending" | "sending" | "sent" | "failed" | "skipped"
  dueAt: string
}

async function send(row: Send) {
  const { db } = await import("@/lib/db")
  count += 1
  const businessId = row.businessId ?? "b1"
  await db.insert(bookings).values({
    id: `bk-${count}`,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: row.dueAt,
    endAt: row.dueAt,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerKey: customerKey(row.customerPhone, row.customerName),
    status: "confirmed",
  })
  await db.insert(notificationSends).values({
    id: `ns-${count}`,
    businessId,
    bookingId: `bk-${count}`,
    message: row.message,
    visitAt: row.dueAt,
    dueAt: row.dueAt,
    state: row.state,
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-notifications-test-"))
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
  for (const id of ["b1", "b2"]) {
    await db.insert(businesses).values({
      id,
      slug: id,
      name: "Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    })
  }
})

afterEach(async () => {
  const { db } = await import("@/lib/db")
  await db.delete(notificationSends)
  await db.delete(bookings)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function names(filter?: Parameters<typeof notificationHistoryFor>[1]) {
  return (await notificationHistoryFor("b1", filter)).map((row) => row.customerName)
}

async function seed() {
  await send({
    customerName: "Ana Diaz",
    customerPhone: "+1 (809) 555-0101",
    message: "confirmed",
    state: "sent",
    dueAt: "2026-06-01T10:00:00.000Z",
  })
  await send({
    customerName: "Luis 100%_off",
    customerPhone: null,
    message: "reminder",
    state: "failed",
    dueAt: "2026-06-02T10:00:00.000Z",
  })
  await send({
    customerName: "Marta",
    customerPhone: "18095550202",
    message: "reminder",
    state: "pending",
    dueAt: "2026-06-03T10:00:00.000Z",
  })
  await send({
    businessId: "b2",
    customerName: "Ana Other",
    customerPhone: "18095550101",
    message: "confirmed",
    state: "sent",
    dueAt: "2026-06-04T10:00:00.000Z",
  })
}

test("no filter: this business's messages, newest first", async () => {
  await seed()
  expect(await names()).toEqual(["Marta", "Luis 100%_off", "Ana Diaz"])
})

test("filters by message and by state, together", async () => {
  await seed()
  expect(await names({ message: "reminder" })).toEqual(["Marta", "Luis 100%_off"])
  expect(await names({ state: "sent" })).toEqual(["Ana Diaz"])
  expect(await names({ message: "reminder", state: "failed" })).toEqual(["Luis 100%_off"])
  expect(await names({ message: "cancelled" })).toEqual([])
})

test("searches the name in any case", async () => {
  await seed()
  expect(await names({ search: "  ana " })).toEqual(["Ana Diaz"])
  expect(await names({ search: "MAR" })).toEqual(["Marta"])
})

test("searches the phone by its digits, however it is written", async () => {
  await seed()
  expect(await names({ search: "809-555-0101" })).toEqual(["Ana Diaz"])
  expect(await names({ search: "+1 809 555" })).toEqual(["Marta", "Ana Diaz"])
})

test("takes % and _ in a search literally", async () => {
  await seed()
  expect(await names({ search: "%_" })).toEqual(["Luis 100%_off"])
  expect(await names({ search: "_" })).toEqual(["Luis 100%_off"])
})

test("a blank search finds everything", async () => {
  await seed()
  expect(await names({ search: "   " })).toEqual(["Marta", "Luis 100%_off", "Ana Diaz"])
})
