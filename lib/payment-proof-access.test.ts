// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookings, businesses, teamMembers, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
const who = vi.hoisted(() => ({
  session: null as { userId: string; phone: string | null; isGuest: boolean } | null,
  admins: [] as string[],
}))
vi.mock("@/lib/dal", () => ({
  getSession: async () => who.session,
  isAdmin: async (userId: string) => who.admins.includes(userId),
}))
vi.mock("@/lib/customer-dal", () => ({
  getCustomer: async () =>
    who.session && !who.session.isGuest
      ? { userId: who.session.userId, name: "x", phone: who.session.phone }
      : null,
}))

const { proofNameFor } = await import("./payment-proof-access")

let dir: string
const PROOF = "11111111-2222-3333-4444-555555555555.jpg"
const as = (userId: string, phone: string | null = null) => {
  who.session = { userId, phone, isGuest: false }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-proof-access-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values(
    ["owner", "other-owner", "customer", "stranger", "member", "other-member", "admin"].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: false,
    }))
  )
  await db.insert(businesses).values([
    { id: "biz", slug: "shop", name: "Shop", timezone: "UTC", currency: "USD", ownerId: "owner" },
    { id: "biz2", slug: "shop2", name: "Shop 2", timezone: "UTC", currency: "USD", ownerId: "other-owner" },
  ])
  await db.insert(teamMembers).values([
    { id: "tm1", businessId: "biz", name: "Mia", userId: "member" },
    { id: "tm2", businessId: "biz", name: "Leo", userId: "other-member" },
  ])
  await db.insert(bookings).values({
    id: "bk",
    businessId: "biz",
    teamMemberId: "tm1",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "USD",
    startAt: "2027-01-10T15:00:00.000Z",
    endAt: "2027-01-10T15:30:00.000Z",
    customerName: "Ana",
    customerPhone: "+18095550000",
    customerKey: "p:18095550000",
    customerUserId: "customer",
    status: "confirmed",
    paymentChoice: "now",
    paymentStatus: "reported",
    paymentProof: PROOF,
  })
})

beforeEach(async () => {
  who.session = null
  who.admins = []
  await db.update(businesses).set({ paymentProofTeam: true })
  await db.update(bookings).set({ paymentProof: PROOF })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("signed out, there is nothing", async () => {
  expect(await proofNameFor("bk")).toBeNull()
})

test("the owner, the customer, the booking's team member and an admin may open it", async () => {
  as("owner")
  expect(await proofNameFor("bk")).toBe(PROOF)
  as("customer")
  expect(await proofNameFor("bk")).toBe(PROOF)
  // The customer by their proved phone, on another account.
  as("stranger", "+18095550000")
  expect(await proofNameFor("bk")).toBe(PROOF)
  as("member")
  expect(await proofNameFor("bk")).toBe(PROOF)
  who.admins = ["admin"]
  as("admin")
  expect(await proofNameFor("bk")).toBe(PROOF)
})

test("nobody else may", async () => {
  as("stranger")
  expect(await proofNameFor("bk")).toBeNull()
  as("stranger", "+18095559999")
  expect(await proofNameFor("bk")).toBeNull()
  as("other-owner")
  expect(await proofNameFor("bk")).toBeNull()
  // A member of the same business, on someone else's booking.
  as("other-member")
  expect(await proofNameFor("bk")).toBeNull()
})

test("the team member loses it the moment the owner turns that off", async () => {
  await db.update(businesses).set({ paymentProofTeam: false }).where(eq(businesses.id, "biz"))
  as("member")
  expect(await proofNameFor("bk")).toBeNull()
  as("owner")
  expect(await proofNameFor("bk")).toBe(PROOF)
})

test("a booking with no picture, or no such booking, gives nothing to anyone", async () => {
  await db.update(bookings).set({ paymentProof: null })
  as("owner")
  expect(await proofNameFor("bk")).toBeNull()
  expect(await proofNameFor("nope")).toBeNull()
})
