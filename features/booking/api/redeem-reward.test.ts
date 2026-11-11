// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businessHours,
  businesses,
  paymentMethods,
  rewardRules,
  rewards,
  services,
  user,
} from "@/lib/db/schema"
import type { RewardCopy } from "@/lib/reward-rules"

// Redeeming a reward when booking (docs/plans/rewards.md, RW-6).
vi.mock("server-only", () => ({}))
const signedIn = {
  session: null as {
    userId: string
    isGuest: boolean
    phone: string | null
  } | null,
}
vi.mock("@/lib/dal", () => ({ getSession: async () => signedIn.session }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/google-calendar-sync", () => ({ requestGoogleSync: vi.fn() }))

const { createBooking } = await import("./create-booking")
const { recountBooking } = await import("@/lib/rewards")

// Monday 2026-06-01 08:00 in Santo Domingo.
const NOW = Date.UTC(2026, 5, 1, 12, 0)
const ANA = { userId: "u-ana", isGuest: false, phone: "+18095550134" }
const ANA_KEY = "p:18095550134"
const FREE: RewardCopy = {
  type: "free",
  value: null,
  maxDiscountMinor: null,
  services: null,
}

let dir: string

async function reward(values: Partial<typeof rewards.$inferInsert> = {}) {
  await db.insert(rewards).values({
    id: "w1",
    businessId: "biz",
    ruleId: "rule",
    customerKey: ANA_KEY,
    reward: FREE,
    earnedAt: new Date(NOW - 86_400_000).toISOString(),
    ...values,
  })
}

const book = (time: string, extra: Record<string, unknown> = {}) =>
  createBooking({
    slug: "shop",
    serviceId: "cut",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time,
    name: "Ana",
    phone: "+18095550134",
    email: "ana@example.com",
    ...extra,
  })

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-redeem-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.PAYMENT_PROOFS_DIR = join(dir, "proofs")
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    {
      id: "u-ana",
      name: "Ana",
      email: "ana@example.com",
      emailVerified: false,
    },
    {
      id: "u-eve",
      name: "Eve",
      email: "eve@example.com",
      emailVerified: false,
    },
  ])
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "USD",
    status: "operational",
    seats: 1,
  })
  await db.insert(businessHours).values({
    id: "h",
    businessId: "biz",
    weekday: 1,
    opensAt: "09:00",
    closesAt: "18:00",
  })
  await db.insert(services).values([
    {
      id: "cut",
      businessId: "biz",
      name: "Haircut",
      durationMinutes: 30,
      priceMinor: 2500,
    },
    {
      id: "color",
      businessId: "biz",
      name: "Color",
      durationMinutes: 30,
      priceMinor: 6000,
      position: 1,
    },
  ])
  await db.insert(rewardRules).values({
    id: "rule",
    businessId: "biz",
    earnType: "visit",
    goal: 5,
    rewardType: "free",
    startsAt: new Date(NOW - 30 * 86_400_000).toISOString(),
  })
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
  signedIn.session = ANA
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete(bookings)
  await db.delete(rewards)
  await db.delete(paymentMethods)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a free-service reward makes the booking free and is held by it", async () => {
  await reward()
  const result = await book("10:00", { rewardId: "w1" })
  expect(result).toMatchObject({
    status: "booked",
    booking: { priceMinor: 0, rewardDiscountMinor: 2500 },
  })
  const [row] = await db.select().from(bookings)
  expect(row).toMatchObject({
    priceMinor: 0,
    rewardId: "w1",
    rewardDiscountMinor: 2500,
  })
  expect((await db.select().from(rewards))[0].status).toBe("held")
})

test("a percent reward takes its share off the service", async () => {
  await reward({ reward: { ...FREE, type: "percent", value: 20 } })
  const result = await book("10:00", { rewardId: "w1" })
  expect(result).toMatchObject({
    status: "booked",
    booking: { priceMinor: 2000, rewardDiscountMinor: 500 },
  })
})

test("signed out, or without a proved phone, nothing is redeemed", async () => {
  await reward()
  // Signed out, nothing is booked at all (EM-D7).
  signedIn.session = null
  expect(await book("10:00", { rewardId: "w1" })).toEqual({
    status: "signIn",
  })
  // Signed in with Google, no phone proved: the typed phone is not enough.
  signedIn.session = { ...ANA, phone: null }
  expect(await book("10:00", { rewardId: "w1" })).toEqual({
    status: "invalid",
    field: "reward",
  })
  expect(await db.select().from(bookings)).toEqual([])
  expect((await db.select().from(rewards))[0].status).toBe("available")
})

test("someone else's reward is refused, even typing their phone", async () => {
  await reward()
  signedIn.session = { userId: "u-eve", isGuest: false, phone: "+18095559999" }
  expect(await book("10:00", { rewardId: "w1" })).toEqual({
    status: "invalid",
    field: "reward",
  })
})

test("an expired reward, one already used, or one for another service is refused", async () => {
  await reward({ expiresAt: new Date(NOW - 1000).toISOString() })
  expect((await book("10:00", { rewardId: "w1" })).status).toBe("invalid")
  await db.update(rewards).set({ expiresAt: null, status: "used" })
  expect((await book("10:00", { rewardId: "w1" })).status).toBe("invalid")
  await db.update(rewards).set({
    status: "available",
    reward: { ...FREE, services: [{ id: "color", name: "Color" }] },
  })
  expect((await book("10:00", { rewardId: "w1" })).status).toBe("invalid")
  expect(await db.select().from(bookings)).toEqual([])
})

test("one reward cannot be spent on two bookings", async () => {
  await reward()
  const [first, second] = await Promise.all([
    book("10:00", { rewardId: "w1" }),
    book("11:00", { rewardId: "w1" }),
  ])
  expect([first.status, second.status].sort()).toEqual(["booked", "invalid"])
  expect(await db.select().from(bookings)).toHaveLength(1)
})

test("a booking its reward made free asks for no way to pay; a discounted one still does", async () => {
  await db.insert(paymentMethods).values({
    id: "zelle",
    businessId: "biz",
    type: "zelle",
    name: "Zelle",
    details: "pay@shop.example",
  })
  await reward()
  const free = await book("10:00", { rewardId: "w1" })
  expect(free).toMatchObject({ status: "booked", booking: { payment: null } })
  const [row] = await db.select().from(bookings)
  expect(row.paymentChoice).toBeNull()

  await reward({ id: "w2", reward: { ...FREE, type: "percent", value: 20 } })
  expect(await book("11:00", { rewardId: "w2" })).toEqual({
    status: "invalid",
    field: "payment",
  })
})

test("cancelling the booking gives the reward back, ready to redeem again", async () => {
  await reward()
  const result = await book("10:00", { rewardId: "w1" })
  const id = result.status === "booked" ? result.booking.id : ""
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, id))
  await recountBooking(id)
  expect((await db.select().from(rewards))[0].status).toBe("available")
  expect((await book("11:00", { rewardId: "w1" })).status).toBe("booked")
})
