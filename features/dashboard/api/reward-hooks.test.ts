// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  rewardEvents,
  rewardRules,
  rewards,
  user,
} from "@/lib/db/schema"

// The owner's buttons move rewards with them (docs/plans/rewards.md, RW-4).
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))
vi.mock("@/lib/google-calendar-sync", () => ({ requestGoogleSync: vi.fn() }))

const { setBookingStatus } = await import("./booking-actions")
const { cancelBooking } = await import("./actions")
const { setBookingPaid } = await import("./payment-actions")

let dir: string
const HOUR = 3_600_000

async function visit(values: Partial<typeof bookings.$inferInsert> = {}) {
  const start = Date.now() - 2 * HOUR
  await db.insert(bookings).values({
    id: "bk",
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 60,
    priceMinor: 2500,
    currency: "USD",
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + HOUR).toISOString(),
    customerName: "Ana",
    customerPhone: "+18095550000",
    customerKey: "p:18095550000",
    status: "confirmed",
    ...values,
  })
}

const total = async () =>
  (await db.select().from(rewardEvents)).reduce(
    (sum, event) => sum + event.amount,
    0
  )

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-reward-hooks-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
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
    currency: "USD",
    ownerId: "u1",
  })
})

afterEach(async () => {
  await db.delete(bookings)
  await db.delete(rewards)
  await db.delete(rewardEvents)
  await db.delete(rewardRules)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

async function rule(values: Partial<typeof rewardRules.$inferInsert> = {}) {
  await db.insert(rewardRules).values({
    id: "rule",
    businessId: "biz",
    earnType: "visit",
    goal: 5,
    rewardType: "free",
    startsAt: new Date(Date.now() - 30 * 24 * HOUR).toISOString(),
    ...values,
  })
}

test("Completed counts the visit at once; No-show takes it back", async () => {
  await rule()
  await visit()
  expect(await setBookingStatus("biz", "bk", "completed")).toEqual({ ok: true })
  expect(await total()).toBe(1)
  expect(await setBookingStatus("biz", "bk", "no_show")).toEqual({ ok: true })
  expect(await total()).toBe(0)
})

test("cancelling gives the booking's reward back to the customer", async () => {
  await rule()
  await db.insert(rewards).values({
    id: "w1",
    businessId: "biz",
    ruleId: "rule",
    customerKey: "p:18095550000",
    reward: {
      type: "free",
      value: null,
      maxDiscountMinor: null,
      services: null,
    },
    status: "held",
    earnedAt: new Date().toISOString(),
  })
  const start = Date.now() + 24 * HOUR
  await visit({
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + HOUR).toISOString(),
    priceMinor: 0,
    rewardId: "w1",
    rewardDiscountMinor: 2500,
  })
  expect(await cancelBooking("biz", "bk")).toEqual({ ok: true })
  const [reward] = await db.select().from(rewards)
  expect(reward.status).toBe("available")
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, "bk"))
  expect(booking).toMatchObject({ rewardId: null, priceMinor: 2500 })
})

test("Mark as paid counts the visit on a paid-only rule", async () => {
  await rule({ paidOnly: true })
  await visit({ paymentChoice: "later", paymentStatus: "unpaid" })
  await setBookingStatus("biz", "bk", "completed")
  expect(await total()).toBe(0)
  expect(await setBookingPaid("biz", "bk", true)).toEqual({ ok: true })
  expect(await total()).toBe(1)
  expect(await setBookingPaid("biz", "bk", false)).toEqual({ ok: true })
  expect(await total()).toBe(0)
})
