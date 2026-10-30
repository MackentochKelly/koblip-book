// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  bookings,
  businesses,
  businessHours,
  businessPhotos,
  services,
  session,
  teamMemberServices,
  teamMembers,
  user,
} from "@/lib/db/schema"
import { DEMO_RULES } from "@/lib/demo-rules"
import { DEMO_SAMPLE } from "../sample"

vi.mock("server-only", () => ({}))

const { createDemoCopy, findDemoCopy } = await import("./demo-copy")
const { purgeOldDemos } = await import("./purge-demos")
const { mayOpenNewDemo, resetNewDemoLimitForTests } =
  await import("./new-demo-limit")

const HOUR = 3_600_000
let closeDb: () => void
let dir: string
let db: Awaited<typeof import("@/lib/db")>["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-demo-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  db = (await import("@/lib/db")).db
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    {
      id: "guest",
      name: "Demo",
      email: "guest@anonymous.placeholder.invalid",
      isAnonymous: true,
    },
    {
      id: "old-guest",
      name: "Demo",
      email: "old@anonymous.placeholder.invalid",
      isAnonymous: true,
      createdAt: new Date(Date.now() - (DEMO_RULES.keepHours + 1) * HOUR),
    },
    { id: "owner", name: "Owner", email: "owner@example.com" },
  ])
  await db.insert(session).values({
    id: "old-session",
    token: "old-token",
    userId: "old-guest",
    expiresAt: new Date(Date.now() + HOUR),
    updatedAt: new Date(),
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a copy is the full sample, owned by the guest and marked demo", async () => {
  const copy = await createDemoCopy("guest")
  const [row] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, copy.id))
  expect(row).toMatchObject({
    name: DEMO_SAMPLE.name,
    ownerId: "guest",
    isDemo: true,
  })
  expect(copy.slug.startsWith(DEMO_SAMPLE.slugPrefix)).toBe(true)
  const count = async (table: typeof services | typeof teamMembers) =>
    (await db.select().from(table).where(eq(table.businessId, copy.id))).length
  expect(await count(services)).toBe(DEMO_SAMPLE.services.length)
  expect(
    (
      await db
        .select()
        .from(businessPhotos)
        .where(eq(businessPhotos.businessId, copy.id))
    ).length
  ).toBe(DEMO_SAMPLE.photos.length)
  expect(await count(teamMembers)).toBe(DEMO_SAMPLE.team.length)
  expect(
    (
      await db
        .select()
        .from(businessHours)
        .where(eq(businessHours.businessId, copy.id))
    ).length
  ).toBe(DEMO_SAMPLE.hours.length)
  expect(
    (
      await db
        .select()
        .from(teamMemberServices)
        .where(eq(teamMemberServices.businessId, copy.id))
    ).length
  ).toBe(DEMO_SAMPLE.team.reduce((sum, m) => sum + m.services.length, 0))
  // Sundays are skipped, so at least most of the week's bookings land.
  const booked = await db
    .select()
    .from(bookings)
    .where(eq(bookings.businessId, copy.id))
  expect(booked.length).toBeGreaterThan(DEMO_SAMPLE.bookings.length / 2)
  expect(await findDemoCopy("guest")).toEqual(copy)
})

test("a real owner's business is never found as a demo copy", async () => {
  await db.insert(businesses).values({
    id: "real",
    slug: "real-shop",
    name: "Real Shop",
    timezone: "Europe/Madrid",
    currency: "EUR",
    ownerId: "owner",
  })
  expect(await findDemoCopy("owner")).toBeNull()
})

test("the purge deletes old copies with their rows, and old guests", async () => {
  const old = await createDemoCopy(
    "guest",
    Date.now() - (DEMO_RULES.keepHours + 1) * HOUR
  )
  await db
    .update(businesses)
    .set({
      createdAt: new Date(
        Date.now() - (DEMO_RULES.keepHours + 1) * HOUR
      ).toISOString(),
    })
    .where(eq(businesses.id, old.id))
  await purgeOldDemos()
  const left = await db.select({ id: businesses.id }).from(businesses)
  expect(left.map((row) => row.id)).not.toContain(old.id)
  expect(left.map((row) => row.id)).toContain("real")
  expect(
    await db.select().from(bookings).where(eq(bookings.businessId, old.id))
  ).toHaveLength(0)
  expect(
    await db.select().from(services).where(eq(services.businessId, old.id))
  ).toHaveLength(0)
  const users = await db.select({ id: user.id }).from(user)
  expect(users.map((row) => row.id).sort()).toEqual(["guest", "owner"])
  expect(await db.select().from(session)).toHaveLength(0)
  // The guest's newer copy stays.
  expect(await findDemoCopy("guest")).not.toBeNull()
})

test("one address opens only so many new copies an hour", () => {
  resetNewDemoLimitForTests()
  const now = Date.now()
  for (let i = 0; i < DEMO_RULES.newPerAddressPerHour; i++) {
    expect(mayOpenNewDemo("1.2.3.4", now)).toBe(true)
  }
  expect(mayOpenNewDemo("1.2.3.4", now)).toBe(false)
  expect(mayOpenNewDemo("5.6.7.8", now)).toBe(true)
  expect(mayOpenNewDemo("1.2.3.4", now + HOUR + 1)).toBe(true)
})
