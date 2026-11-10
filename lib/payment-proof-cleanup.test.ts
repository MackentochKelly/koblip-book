// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { bookings, businesses, user } from "@/lib/db/schema"
import { PAYMENT_RULES } from "./payment-rules"

vi.mock("server-only", () => ({}))

const { sweepPaymentProofs } = await import("./payment-proof-cleanup")
const { readProof } = await import("./payment-proofs")

let dir: string
let proofs: string
const NOW = Date.parse("2027-06-01T12:00:00.000Z")
const DAY = 86_400_000
const name = (n: number) => `${String(n).repeat(8)}-0000-0000-0000-000000000000.jpg`

// A picture in the store, saved `hoursAgo` before NOW.
function file(n: number, hoursAgo: number) {
  const path = join(proofs, name(n))
  writeFileSync(path, "picture")
  const at = new Date(NOW - hoursAgo * 3_600_000)
  utimesSync(path, at, at)
}

async function booked(n: number, daysAgo: number) {
  await db.insert(bookings).values({
    id: `bk${n}`,
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "USD",
    startAt: new Date(NOW - daysAgo * DAY).toISOString(),
    endAt: new Date(NOW - daysAgo * DAY + 1_800_000).toISOString(),
    customerName: "Ana",
    status: "confirmed",
    paymentChoice: "now",
    paymentStatus: "paid",
    paymentProof: name(n),
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-proof-cleanup-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  proofs = join(dir, "proofs")
  process.env.PAYMENT_PROOFS_DIR = proofs
  mkdirSync(proofs)
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({ id: "u1", name: "Owner", email: "o@example.com", emailVerified: false })
  await db.insert(businesses).values({
    id: "biz", slug: "shop", name: "Shop", timezone: "UTC", currency: "USD", ownerId: "u1",
  })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("pictures go when due, and the ones no booking holds", async () => {
  // 1: a booking past the keep days. 2: one still inside them.
  await booked(1, PAYMENT_RULES.proofKeepDays + 1)
  file(1, 24 * 100)
  await booked(2, PAYMENT_RULES.proofKeepDays - 1)
  file(2, 24 * 80)
  // 3: left behind by a deleted booking. 4: being sent right now.
  file(3, 5)
  file(4, 0)
  // Not one of ours: never touched.
  writeFileSync(join(proofs, "notes.txt"), "keep")

  expect(await sweepPaymentProofs(NOW)).toBe(2)

  expect(existsSync(join(proofs, name(1)))).toBe(false)
  expect(existsSync(join(proofs, name(2)))).toBe(true)
  expect(existsSync(join(proofs, name(3)))).toBe(false)
  expect(existsSync(join(proofs, name(4)))).toBe(true)
  expect(existsSync(join(proofs, "notes.txt"))).toBe(true)
  const rows = await db.select({ id: bookings.id, proof: bookings.paymentProof }).from(bookings)
  expect(Object.fromEntries(rows.map((row) => [row.id, row.proof]))).toEqual({
    bk1: null,
    bk2: name(2),
  })
  // A second sweep finds nothing new.
  expect(await sweepPaymentProofs(NOW)).toBe(0)
})

test("a name that is not one of ours is never read", async () => {
  expect(await readProof("../test.db")).toBeNull()
  expect(await readProof("notes.txt")).toBeNull()
  expect(await readProof(null)).toBeNull()
})
