// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { asc, eq } from "drizzle-orm"
import {
  bookings,
  businessHours,
  businesses,
  notificationSends,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { moveOwnerBooking } = await import("./move-owner-booking")

// Monday 2026-06-01 08:00 in Santo Domingo (UTC-4); open Mondays 09:00-18:00.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

async function booking(
  id: string,
  startAt: string,
  values: Partial<typeof bookings.$inferInsert> = {}
) {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id,
    businessId: "biz-owner",
    teamMemberId: null,
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt,
    endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(),
    customerName: "Luis",
    status: "confirmed",
    ...values,
  })
}

async function send(
  bookingId: string,
  message: "confirmed" | "reminder" | "changed",
  state: "pending" | "sent",
  reminderMinutes = 0
) {
  const { db } = await import("@/lib/db")
  await db.insert(notificationSends).values({
    businessId: "biz-owner",
    bookingId,
    message,
    reminderMinutes,
    dueAt: "2026-06-01T12:00:00.000Z",
    state,
  })
}

async function row(id: string) {
  const { db } = await import("@/lib/db")
  const [found] = await db.select().from(bookings).where(eq(bookings.id, id))
  return found
}

function move(bookingId: string, date: string, time: string, allowConflict = false) {
  return moveOwnerBooking({ businessId: "biz-owner", bookingId, date, time, allowConflict })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-move-booking-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-owner",
      slug: "owner-shop",
      name: "Owner Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      seats: 1,
      ownerId: "u1",
    },
    {
      id: "biz-theirs",
      slug: "their-shop",
      name: "Their Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      seats: 1,
      ownerId: "other",
    },
  ])
  await db.insert(businessHours).values({
    id: "biz-owner-h",
    businessId: "biz-owner",
    weekday: 1,
    opensAt: "09:00",
    closesAt: "18:00",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(async () => {
  vi.restoreAllMocks()
  const { db } = await import("@/lib/db")
  await db.delete(notificationSends)
  await db.delete(bookings)
})

test("moves the booking, counts the move and stops its waiting reminders", async () => {
  await booking("bk", "2026-06-01T19:00:00.000Z")
  await send("bk", "confirmed", "sent")
  await send("bk", "reminder", "sent", 1440)
  await send("bk", "reminder", "pending", 120)

  expect(await move("bk", "2026-06-08", "10:30")).toEqual({ status: "moved" })

  expect(await row("bk")).toMatchObject({
    startAt: "2026-06-08T14:30:00.000Z",
    endAt: "2026-06-08T15:00:00.000Z",
    moves: 1,
  })
  const { db } = await import("@/lib/db")
  const sends = await db
    .select()
    .from(notificationSends)
    .orderBy(asc(notificationSends.message), asc(notificationSends.reminderMinutes))
  expect(sends.map(({ message, reminderMinutes, state, reason }) => ({
    message,
    reminderMinutes,
    state,
    reason,
  }))).toEqual([
    { message: "confirmed", reminderMinutes: 0, state: "sent", reason: null },
    { message: "reminder", reminderMinutes: 120, state: "skipped", reason: "moved" },
    { message: "reminder", reminderMinutes: 1440, state: "sent", reason: null },
  ])

  expect(await move("bk", "2026-06-08", "11:00")).toEqual({ status: "moved" })
  expect((await row("bk")).moves).toBe(2)
})

test("the same time changes nothing", async () => {
  await booking("bk", "2026-06-01T19:00:00.000Z")
  expect(await move("bk", "2026-06-01", "15:00")).toEqual({ status: "moved" })
  expect((await row("bk")).moves).toBe(0)
})

test("a closed or taken time asks first, then can be moved anyway", async () => {
  await booking("bk", "2026-06-01T19:00:00.000Z")
  await booking("busy", "2026-06-01T14:00:00.000Z")

  expect(await move("bk", "2026-06-01", "19:00")).toEqual({
    status: "conflict",
    reason: "closed",
  })
  expect(await move("bk", "2026-06-01", "10:00")).toEqual({
    status: "conflict",
    reason: "busy",
  })
  expect((await row("bk")).moves).toBe(0)

  expect(await move("bk", "2026-06-01", "10:00", true)).toEqual({ status: "moved" })
  expect(await row("bk")).toMatchObject({ startAt: "2026-06-01T14:00:00.000Z", moves: 1 })
})

test("its own old time does not count as taken", async () => {
  await booking("bk", "2026-06-01T19:00:00.000Z")
  expect(await move("bk", "2026-06-01", "15:15")).toEqual({ status: "moved" })
})

test("with two seats, one other booking leaves room", async () => {
  await booking("bk", "2026-06-01T19:00:00.000Z")
  const { db } = await import("@/lib/db")
  await db.update(businesses).set({ seats: 2 }).where(eq(businesses.id, "biz-owner"))
  await booking("busy", "2026-06-01T14:00:00.000Z")
  expect(await move("bk", "2026-06-01", "10:00")).toEqual({ status: "moved" })
  await db.update(businesses).set({ seats: 1 }).where(eq(businesses.id, "biz-owner"))
})

test("refuses a past day or time", async () => {
  await booking("bk", "2026-06-01T19:00:00.000Z")
  expect(await move("bk", "2026-05-31", "10:00")).toEqual({
    status: "invalid",
    field: "date",
  })
  expect(await move("bk", "2026-06-01", "07:30")).toEqual({
    status: "invalid",
    field: "time",
  })
  expect(await move("bk", "2026-02-30", "10:00")).toEqual({
    status: "invalid",
    field: "date",
  })
  expect(await move("bk", "2026-06-01", "25:00")).toEqual({
    status: "invalid",
    field: "time",
  })
})

test("only a confirmed booking of the owner's that has not started", async () => {
  await booking("cancelled", "2026-06-01T19:00:00.000Z", { status: "cancelled" })
  await booking("started", "2026-06-01T11:30:00.000Z")
  await booking("theirs", "2026-06-01T19:00:00.000Z", { businessId: "biz-theirs" })
  expect(await move("cancelled", "2026-06-08", "10:00")).toEqual({ status: "failed" })
  expect(await move("started", "2026-06-08", "10:00")).toEqual({ status: "failed" })
  expect(await move("theirs", "2026-06-08", "10:00")).toEqual({ status: "failed" })
  expect(
    await moveOwnerBooking({
      businessId: "biz-theirs",
      bookingId: "theirs",
      date: "2026-06-08",
      time: "10:00",
      allowConflict: false,
    })
  ).toEqual({ status: "failed" })
})
