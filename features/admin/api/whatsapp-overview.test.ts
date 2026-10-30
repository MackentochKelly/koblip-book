// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  notificationSends,
  notificationTimer,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))

const { getWhatsappOverview } = await import("./whatsapp-overview")

let dir: string
let closeDb: () => void
const NOW = Date.parse("2026-10-30T12:00:00.000Z")

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-whatsapp-overview-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(businesses).values([
    {
      id: "real",
      slug: "real",
      name: "Real",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
    },
    {
      id: "demo",
      slug: "demo",
      name: "Demo",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      isDemo: true,
    },
  ])
  const at = new Date(NOW).toISOString()
  for (const businessId of ["real", "demo"]) {
    await db.insert(bookings).values({
      id: `bk-${businessId}`,
      businessId,
      serviceName: "Visit",
      durationMinutes: 30,
      currency: "DOP",
      startAt: at,
      endAt: at,
      customerName: "Ana",
    })
  }
  const old = new Date(NOW - 8 * 86_400_000).toISOString()
  const send = (
    businessId: string,
    message: "confirmed" | "reminder" | "changed" | "cancelled",
    state: "pending" | "sending" | "failed" | "sent",
    updatedAt = at
  ) => ({
    businessId,
    bookingId: `bk-${businessId}`,
    message,
    dueAt: at,
    state,
    createdAt: updatedAt,
    updatedAt,
  })
  await db
    .insert(notificationSends)
    .values([
      send("real", "confirmed", "pending"),
      send("real", "reminder", "sending"),
      send("real", "changed", "failed"),
      send("real", "cancelled", "failed", old),
      send("demo", "confirmed", "pending"),
    ])
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

afterAll(() => {
  vi.useRealTimers()
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("counts what waits and what failed lately, leaving demo copies out", async () => {
  vi.stubEnv("CHAT_API_URL", "")
  const overview = await getWhatsappOverview()
  expect(overview.waiting).toBe(2)
  expect(overview.failed).toBe(1)
})

test("the timer has never run, runs, or is late after three waits", async () => {
  vi.stubEnv("CHAT_API_URL", "")
  expect((await getWhatsappOverview()).timer).toEqual({ state: "never" })

  const recent = new Date(NOW - 60_000).toISOString()
  await db
    .insert(notificationTimer)
    .values({ id: "timer", lastRunAt: recent, lastError: null })
  expect((await getWhatsappOverview()).timer).toEqual({
    state: "running",
    lastRunAt: recent,
    lastError: null,
  })

  const late = new Date(NOW - 181_000).toISOString()
  await db.update(notificationTimer).set({ lastRunAt: late, lastError: "boom" })
  expect((await getWhatsappOverview()).timer).toEqual({
    state: "late",
    lastRunAt: late,
    lastError: "boom",
  })
})

test("Koblip Chat: not set up, in reach on any answer, out of reach on none", async () => {
  vi.stubEnv("CHAT_API_URL", "")
  expect((await getWhatsappOverview()).chat).toBe("notSet")

  vi.stubEnv("CHAT_API_URL", "http://chat.test")
  const fetch = vi.spyOn(globalThis, "fetch")
  fetch.mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect((await getWhatsappOverview()).chat).toBe("reachable")
  fetch.mockRejectedValueOnce(new TypeError("fetch failed"))
  expect((await getWhatsappOverview()).chat).toBe("unreachable")
  fetch.mockRestore()
})

test("says whether each server setting is set, never its value", async () => {
  vi.stubEnv("CHAT_API_URL", "")
  vi.stubEnv("CHAT_EVENTS_SECRET", "a-secret-value")
  const { secrets } = await getWhatsappOverview()
  expect(secrets).toContainEqual({ name: "CHAT_EVENTS_SECRET", set: true })
  expect(secrets).toContainEqual({ name: "CHAT_API_URL", set: false })
  expect(JSON.stringify(secrets)).not.toContain("a-secret-value")
})
