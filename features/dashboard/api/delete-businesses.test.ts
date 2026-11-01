// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, services, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
const { deleteBusinesses, ownedBusinessIds } = await import("./delete-businesses")
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "book-delete-businesses-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.$client.execute("PRAGMA foreign_keys = ON")
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("an owner's businesses go with everything in them, then the account can go", async () => {
  await db.insert(user).values([
    { id: "owner", name: "Owner", email: "delete-owner@example.com", emailVerified: true },
    { id: "other", name: "Other", email: "delete-other@example.com", emailVerified: true },
  ])
  const business = (id: string, ownerId: string) => ({
    id, slug: id, name: id, ownerId, timezone: "America/New_York", currency: "USD",
  })
  await db.insert(businesses).values([
    business("mine", "owner"),
    business("also-mine", "owner"),
    business("theirs", "other"),
  ])
  await db.insert(services).values([
    { businessId: "mine", name: "Cut", durationMinutes: 30, priceCents: 1000 },
    { businessId: "theirs", name: "Cut", durationMinutes: 30, priceCents: 1000 },
  ])

  const ids = await ownedBusinessIds("owner")
  expect(ids.sort()).toEqual(["also-mine", "mine"])
  await deleteBusinesses(ids)
  await db.delete(user).where(eq(user.id, "owner"))

  expect((await db.select({ id: businesses.id }).from(businesses)).map((row) => row.id)).toEqual(["theirs"])
  expect((await db.select({ id: services.businessId }).from(services)).map((row) => row.id)).toEqual(["theirs"])
  expect(await db.select({ id: user.id }).from(user)).toEqual([{ id: "other" }])
})
