// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookings, businesses, teamMembers, user } from "@/lib/db/schema"
import type { TeamSeat } from "@/lib/dal"

vi.mock("server-only", () => ({}))

const { getMyBookings } = await import("./queries")

let dir: string
const SEAT = {
  teamMemberId: "m1",
  name: "Sam",
  photoUrl: null,
  business: {
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
  },
} satisfies TeamSeat

const ZELLE = {
  type: "zelle" as const,
  name: "Zelle",
  details: "pay@shop.example",
}

async function booked(
  id: string,
  values: Partial<typeof bookings.$inferInsert>
) {
  await db.insert(bookings).values({
    id,
    businessId: "biz",
    teamMemberId: "m1",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: "2099-01-05T14:00:00.000Z",
    endAt: "2099-01-05T14:30:00.000Z",
    customerName: "Ana",
    customerPhone: "+18095550000",
    ...values,
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-team-area-test-"))
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
    currency: "DOP",
    ownerId: "u1",
  })
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Sam" },
    { id: "m2", businessId: "biz", name: "Kim" },
  ])
  await booked("zelle", {
    startAt: "2099-01-05T10:00:00.000Z",
    endAt: "2099-01-05T10:30:00.000Z",
    paymentChoice: "now",
    paymentMethod: ZELLE,
    paymentStatus: "reported",
    paymentReference: "TX-SECRET",
    paymentProof: "proof-zelle.webp",
  })
  await booked("later", {
    startAt: "2099-01-05T11:00:00.000Z",
    endAt: "2099-01-05T11:30:00.000Z",
    paymentChoice: "later",
    paymentStatus: "unpaid",
  })
  await booked("plain", {
    startAt: "2099-01-05T12:00:00.000Z",
    endAt: "2099-01-05T12:30:00.000Z",
  })
  await booked("theirs", {
    teamMemberId: "m2",
    paymentChoice: "now",
    paymentMethod: ZELLE,
    paymentStatus: "paid",
  })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a team member sees how their own bookings are paid, and where it stands", async () => {
  const mine = await getMyBookings(SEAT, "upcoming")
  expect(mine.map(({ id, payment }) => [id, payment])).toEqual([
    ["zelle", { way: "Zelle", status: "reported", proof: true, paidOnlineMinor: null, currency: "DOP" }],
    ["later", { way: null, status: "unpaid", proof: false, paidOnlineMinor: null, currency: "DOP" }],
    ["plain", null],
  ])
})

test("with the owner's switch off, a team member is told of no picture", async () => {
  await db
    .update(businesses)
    .set({ paymentProofTeam: false })
    .where(eq(businesses.id, "biz"))
  try {
    const mine = await getMyBookings(SEAT, "upcoming")
    expect(mine.find(({ id }) => id === "zelle")?.payment).toEqual({
      way: "Zelle",
      status: "reported",
      proof: false,
      paidOnlineMinor: null,
      currency: "DOP",
    })
  } finally {
    await db
      .update(businesses)
      .set({ paymentProofTeam: true })
      .where(eq(businesses.id, "biz"))
  }
})

test("the instructions and the customer's reference never reach the team area", async () => {
  const text = JSON.stringify(await getMyBookings(SEAT, "upcoming"))
  expect(text).not.toContain("pay@shop.example")
  expect(text).not.toContain("TX-SECRET")
  expect(text).not.toContain("proof-zelle")
})
