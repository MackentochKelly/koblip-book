// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"

import { db } from "@/lib/db"
import {
  businesses,
  emailBlocks,
  emailSends,
  platformSettingChanges,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin", name: "Admin", email: "admin@example.com" })),
}))

const { getEmailActivity, getEmailBlocks } = await import("./email")
const { removeEmailBlock } = await import("./email-actions")

let dir: string
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 11, 12, minutes)).toISOString()

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-admin-email-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(user)
    .values({ id: "admin", name: "Admin", email: "admin@example.com", emailVerified: true })
  await db.insert(businesses).values([
    { id: "shop", slug: "shop", name: "Shop", timezone: "America/Santo_Domingo", currency: "DOP" },
    { id: "studio", slug: "studio", name: "Studio", timezone: "Europe/Madrid", currency: "EUR" },
  ])
  await db.insert(emailSends).values([
    { id: "s1", kind: "verification", email: "new@example.com", state: "sent", sentAt: at(1) },
    { id: "s2", kind: "ownerNewBooking", email: "owner@example.com", businessId: "shop", state: "failed", reason: "sendFailed", createdAt: at(2) },
    { id: "s3", kind: "bookingConfirmed", email: "ana@example.com", businessId: "studio", state: "sent", delivery: "bounced", sentAt: at(3) },
  ])
  await db.insert(emailBlocks).values([
    { id: "b1", email: "ana@example.com", reason: "bounce", sendId: "s3" },
    { id: "b2", email: "bo_b@example.com", businessId: "shop", reason: "stopped" },
  ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("Emails: every email of every business and none, newest first, each with its business", async () => {
  const rows = await getEmailActivity({})
  expect(rows.map((row) => [row.id, row.businessName, row.timeZone])).toEqual([
    ["s3", "Studio", "Europe/Madrid"],
    ["s2", "Shop", "America/Santo_Domingo"],
    ["s1", null, null],
  ])
  expect((await getEmailActivity({ search: "stud" })).map((row) => row.id)).toEqual(["s3"])
  expect((await getEmailActivity({ kind: "verification" })).map((row) => row.id)).toEqual(["s1"])
  expect((await getEmailActivity({ state: "failed" })).map((row) => row.id)).toEqual(["s2"])
})

test("Blocked: every block, searched by address; unblocking is logged", async () => {
  const all = await getEmailBlocks()
  expect(all.map((row) => [row.email, row.businessName, row.reason]).sort()).toEqual([
    ["ana@example.com", null, "bounce"],
    ["bo_b@example.com", "Shop", "stopped"],
  ])
  // LIKE's "_" taken literally.
  expect((await getEmailBlocks("O_B")).map((row) => row.id)).toEqual(["b2"])
  expect(await getEmailBlocks("oxb")).toEqual([])

  expect(await removeEmailBlock("b2")).toEqual({ ok: true })
  expect((await getEmailBlocks()).map((row) => row.id)).toEqual(["b1"])
  const [change] = await db.select().from(platformSettingChanges)
  expect(change).toMatchObject({
    key: "email.block.remove",
    businessId: "shop",
    before: { email: "bo_b@example.com", reason: "stopped" },
    after: null,
    changedBy: "admin",
  })
})
