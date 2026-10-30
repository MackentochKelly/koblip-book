// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  notificationSends,
  platformSettingChanges,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))

const { getWhatsappUsage } = await import("./whatsapp-usage")
const { saveKoblipLimit } = await import("./whatsapp-usage-actions")

let dir: string
let closeDb: () => void

const NOW = new Date("2026-11-15T12:00:00.000Z")

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-whatsapp-usage-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db
    .insert(user)
    .values({ id: "admin", name: "Admin", email: "admin@example.com", emailVerified: false })
  const business = (id: string, name: string, more = {}) => ({
    id,
    slug: id,
    name,
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "admin",
    ...more,
  })
  await db.insert(businesses).values([
    business("a", "Alpha"),
    business("b", "Beta"),
    business("demo", "Demo", { isDemo: true }),
    business("orphan", "Orphan", { ownerId: null }),
  ])
  await db.insert(bookings).values({
    id: "k1",
    businessId: "b",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: "2026-12-01T15:00:00.000Z",
    endAt: "2026-12-01T15:30:00.000Z",
    customerName: "Ana",
  })
  const sent = (reminderMinutes: number, sentAt: string, more = {}) => ({
    businessId: "b",
    bookingId: "k1",
    message: "reminder" as const,
    reminderMinutes,
    dueAt: sentAt,
    state: "sent" as const,
    via: "template" as const,
    sender: "koblip" as const,
    sentAt,
    ...more,
  })
  await db.insert(notificationSends).values([
    sent(1, "2026-11-01T00:00:00.000Z"),
    sent(2, "2026-11-14T09:00:00.000Z"),
    // Not counted: last month, a normal message, the business's own number.
    sent(3, "2026-10-31T23:59:59.000Z"),
    sent(4, "2026-11-14T09:00:00.000Z", { via: "text" }),
    sent(5, "2026-11-14T09:00:00.000Z", { sender: "own" }),
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("this month's Koblip templates per business it may send for, most first", async () => {
  const usage = await getWhatsappUsage(NOW)
  expect(usage).toMatchObject({ month: "2026-11-01T00:00:00.000Z", limit: 300, changed: false })
  expect(usage.businesses).toEqual([
    { id: "b", name: "Beta", sent: 2, ownLimit: null, limit: 300 },
    { id: "a", name: "Alpha", sent: 0, ownLimit: null, limit: 300 },
  ])
})

test("the limit changes for everyone or one business, each change logged", async () => {
  expect(await saveKoblipLimit(null, 100)).toEqual({ ok: true })
  expect(await saveKoblipLimit("b", 2)).toEqual({ ok: true })
  let usage = await getWhatsappUsage(NOW)
  expect(usage).toMatchObject({ limit: 100, defaultLimit: 300, changed: true })
  expect(usage.businesses.map(({ id, ownLimit, limit }) => [id, ownLimit, limit])).toEqual([
    ["b", 2, 2],
    ["a", null, 100],
  ])

  expect(await saveKoblipLimit("b", -1)).toEqual({ ok: false, error: "invalid" })
  expect(await saveKoblipLimit("missing", 5)).toEqual({ ok: false, error: "invalid" })

  // Back to everyone's, and everyone's back to the default.
  expect(await saveKoblipLimit("b", null)).toEqual({ ok: true })
  expect(await saveKoblipLimit(null, null)).toEqual({ ok: true })
  usage = await getWhatsappUsage(NOW)
  expect(usage.businesses[0]).toMatchObject({ id: "b", ownLimit: null, limit: 300 })

  const log = await db.select().from(platformSettingChanges)
  expect(log.map(({ businessId, before, after }) => [businessId, before, after])).toEqual([
    [null, null, 100],
    ["b", null, 2],
    ["b", 2, null],
    [null, 100, null],
  ])
})
