// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  inAppNotifications,
  reviews,
  user,
} from "@/lib/db/schema"

type Customer = { userId: string; name: string; phone: string | null }
let signedIn: Customer | null = null
let owner = "owner"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }))
vi.mock("@/lib/customer-dal", () => ({
  getCustomer: vi.fn(async () => signedIn),
}))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({ userId: owner })),
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))

const { saveReview, setReviewHidden } = await import("./actions")
const { myReview, reviewSummary, ownerReviews } = await import("./queries")
const { askForReviews } = await import("@/lib/in-app-notifications")

let dir: string
const HOUR = 3_600_000
const DAY = 24 * HOUR

const ana: Customer = { userId: "ana", name: "Ana María", phone: null }
const ben: Customer = { userId: "ben", name: "Ben", phone: null }

// A visit that ended `hoursAgo` hours ago (negative: still ahead).
function visit(
  id: string,
  hoursAgo: number,
  more: Partial<typeof bookings.$inferInsert> = {}
) {
  const end = Date.now() - hoursAgo * HOUR
  return {
    id,
    businessId: "shop",
    serviceName: "Haircut",
    durationMinutes: 60,
    currency: "USD",
    startAt: new Date(end - HOUR).toISOString(),
    endAt: new Date(end).toISOString(),
    customerName: "x",
    customerUserId: "ana",
    ...more,
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-reviews-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "Owner", email: "o@example.com", emailVerified: true },
    { id: "other", name: "Other", email: "x@example.com", emailVerified: true },
    { id: "ana", name: "Ana", email: "a@example.com", emailVerified: true },
    { id: "ben", name: "Ben", email: "b@example.com", emailVerified: true },
  ])
  await db.insert(businesses).values({
    id: "shop",
    slug: "shop",
    name: "Shop",
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
  })
})

beforeEach(async () => {
  signedIn = ana
  owner = "owner"
  await db.delete(inAppNotifications)
  await db.delete(reviews)
  await db.delete(bookings)
  await db
    .insert(bookings)
    .values([
      visit("past", 3),
      visit("ahead", -24),
      visit("cancelled", 3, { status: "cancelled" }),
      visit("old", 10 * 24),
      visit("guest", 3, { customerUserId: null, customerKey: "p:1809" }),
    ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("only a visit that's over and wasn't cancelled can be rated, by its client", async () => {
  expect(await saveReview("ahead", 5, "")).toEqual({ ok: false, error: "not_found" })
  expect(await saveReview("cancelled", 5, "")).toEqual({ ok: false, error: "not_found" })
  signedIn = ben
  expect(await saveReview("past", 5, "")).toEqual({ ok: false, error: "not_found" })
  expect(await myReview(ben, "past")).toBeNull()
  signedIn = ana
  expect((await myReview(ana, "ahead"))?.canReview).toBe(false)
  expect(await saveReview("past", 0, "")).toEqual({ ok: false, error: "invalid" })
  expect(await saveReview("past", 4, "x".repeat(501))).toEqual({ ok: false, error: "invalid" })

  expect(await saveReview("past", 4, "  Great cut  ")).toEqual({ ok: true })
  const [row] = await db.select().from(reviews)
  expect(row).toMatchObject({ stars: 4, comment: "Great cut", authorName: "Ana", userId: "ana" })
  expect(await myReview(ana, "past")).toEqual({
    canReview: true,
    review: { stars: 4, comment: "Great cut", editable: true },
  })
})

test("one review per visit, changed only within the edit days", async () => {
  await saveReview("past", 2, "")
  expect(await saveReview("past", 5, "Better")).toEqual({ ok: true })
  expect(await db.select().from(reviews)).toHaveLength(1)
  await db
    .update(reviews)
    .set({ createdAt: new Date(Date.now() - 15 * DAY).toISOString() })
  expect(await saveReview("past", 1, "")).toEqual({ ok: false, error: "too_late" })
  expect((await myReview(ana, "past"))?.review).toMatchObject({ stars: 5, editable: false })
})

test("the page shows reviews the owner hasn't hidden; only the owner hides one", async () => {
  await db.insert(bookings).values(visit("past2", 5))
  await saveReview("past", 5, "")
  await saveReview("past2", 2, "")
  expect(await reviewSummary("shop")).toMatchObject({ average: 3.5, count: 2 })

  const [low] = await db.select().from(reviews).where(eq(reviews.stars, 2))
  expect(await setReviewHidden("shop", low.id, "rude")).toEqual({ ok: false, error: "invalid" })
  owner = "other"
  expect(await setReviewHidden("shop", low.id, "spam")).toEqual({ ok: false, error: "not_found" })
  expect(await ownerReviews("shop")).toBeNull()
  owner = "owner"
  expect(await setReviewHidden("shop", low.id, "spam")).toEqual({ ok: true })
  expect(await reviewSummary("shop")).toMatchObject({ average: 5, count: 1 })
  const listed = await ownerReviews("shop")
  expect(listed?.map((review) => review.hiddenReason).sort()).toEqual([null, "spam"].sort())

  await setReviewHidden("shop", low.id, null)
  expect((await reviewSummary("shop")).count).toBe(2)
})

test("the bell asks once, for recent visits an account owns with no review yet", async () => {
  const asked = async () =>
    (await db.select().from(inAppNotifications)).map((row) => row.bookingId)
  await askForReviews()
  await askForReviews()
  expect(await asked()).toEqual(["past"])

  await db.delete(inAppNotifications)
  await saveReview("past", 5, "")
  await askForReviews()
  expect(await asked()).toEqual([])
})
