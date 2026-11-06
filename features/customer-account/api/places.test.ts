// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { bookings, businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { myPlaces } = await import("./places")

let dir: string

function booking(id: string, businessId: string, startAt: string, more = {}) {
  return {
    id,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "USD",
    startAt,
    endAt: startAt,
    customerName: "Ana",
    customerUserId: "ana",
    ...more,
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-places-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "O", email: "o@example.com", emailVerified: true },
    { id: "ana", name: "Ana", email: "ana@example.com", emailVerified: true },
  ])
  const shop = (id: string, more = {}) => ({
    id,
    slug: id,
    name: id.toUpperCase(),
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
    ...more,
  })
  await db
    .insert(businesses)
    .values([shop("a"), shop("b"), shop("demo", { isDemo: true })])
  await db.insert(bookings).values([
    booking("a-old", "a", "2026-09-01T10:00:00.000Z"),
    booking("a-new", "a", "2026-10-20T10:00:00.000Z"),
    booking("b-1", "b", "2026-10-01T10:00:00.000Z"),
    booking("d-1", "demo", "2026-10-25T10:00:00.000Z"),
    booking("other", "b", "2026-10-30T10:00:00.000Z", {
      customerUserId: null,
    }),
  ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("each business once, the latest first, never a demo copy or another's booking", async () => {
  const places = await myPlaces(
    { userId: "ana", name: "Ana", phone: null },
    "en-US",
    // Another year: the dates carry theirs.
    new Date("2027-01-05T00:00:00.000Z")
  )
  expect(places.map((place) => [place.business.slug, place.lastWhen])).toEqual([
    ["a", "Oct 20, 2026"],
    ["b", "Oct 1, 2026"],
  ])
})
