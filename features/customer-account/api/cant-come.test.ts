// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  inAppNotifications,
  notificationSends,
  notificationSettings,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/google-calendar-sync", () => ({ requestGoogleSync: vi.fn() }))
const signedIn = vi.hoisted(() => ({
  customer: null as { userId: string; name: string; phone: string } | null,
}))
vi.mock("@/lib/customer-dal", () => ({
  getCustomer: async () => signedIn.customer,
}))

const { cantCome } = await import("./cant-come")

let dir: string
const ANA = { userId: "c1", name: "Ana", phone: "+18095550000" }

async function booked(values: Partial<typeof bookings.$inferInsert> = {}) {
  await db.insert(bookings).values({
    id: "bk",
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: new Date(Date.now() + 86_400_000).toISOString(),
    endAt: new Date(Date.now() + 88_200_000).toISOString(),
    customerName: "Ana",
    customerPhone: "+18095550000",
    customerKey: "p:18095550000",
    status: "confirmed",
    ...values,
  })
}

async function owner(cantComeAction: "cancel" | "alertOnly") {
  await db.insert(notificationSettings).values({
    businessId: "biz",
    ownerPhone: "+18095559999",
    reminders: [1440],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
    cantCome: cantComeAction,
  })
}

const status = async () =>
  (await db.select({ status: bookings.status }).from(bookings))[0]?.status
const alerts = () =>
  db
    .select({
      message: notificationSends.message,
      state: notificationSends.state,
    })
    .from(notificationSends)
const bell = () =>
  db.select({ kind: inAppNotifications.kind }).from(inAppNotifications)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-cant-come-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(user)
    .values({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    })
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
})

afterEach(async () => {
  signedIn.customer = null
  await db.delete(inAppNotifications)
  await db.delete(notificationSends)
  await db.delete(notificationSettings)
  await db.delete(bookings)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("cancels where the owner lets customers cancel, and tells the owner once", async () => {
  signedIn.customer = ANA
  await owner("cancel")
  await booked()
  expect(await cantCome("bk")).toEqual({ ok: true, cancelled: true })
  expect(await cantCome("bk")).toEqual({ ok: false, error: "over" })
  expect(await status()).toBe("cancelled")
  expect(await alerts()).toEqual([
    { message: "ownerCancelled", state: "pending" },
  ])
  expect(await bell()).toEqual([{ kind: "customerCancelled" }])
})

test("keeps the booking and tells the owner when they chose alerts only", async () => {
  signedIn.customer = ANA
  await owner("alertOnly")
  await booked()
  expect(await cantCome("bk")).toEqual({ ok: true, cancelled: false })
  expect(await cantCome("bk")).toEqual({ ok: true, cancelled: false })
  expect(await status()).toBe("confirmed")
  expect(await alerts()).toEqual([
    { message: "ownerCantCome", state: "pending" },
  ])
  expect(await bell()).toEqual([{ kind: "customerCantCome" }])
})

test("acts only on the signed-in customer's own booking still ahead", async () => {
  await owner("cancel")
  await booked()
  expect(await cantCome("bk")).toEqual({ ok: false, error: "signedOut" })
  signedIn.customer = { ...ANA, phone: "+18095551111" }
  expect(await cantCome("bk")).toEqual({ ok: false, error: "notFound" })
  signedIn.customer = ANA
  expect(await cantCome(42)).toEqual({ ok: false, error: "notFound" })
  await db.delete(bookings)
  await booked({ startAt: new Date(Date.now() - 60_000).toISOString() })
  expect(await cantCome("bk")).toEqual({ ok: false, error: "over" })
  expect(await status()).toBe("confirmed")
  expect(await alerts()).toEqual([])
})
