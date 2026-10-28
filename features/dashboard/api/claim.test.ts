// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { claimBusinessForUser } = await import("./claim")

let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-claim-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    { id: "user-a", name: "A", email: "a@example.com", emailVerified: false },
    { id: "user-b", name: "B", email: "b@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values({
    id: "biz-taken",
    slug: "taken-shop",
    name: "Taken Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "user-a",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function ownerIdOf(id: string) {
  const { db } = await import("@/lib/db")
  const [row] = await db
    .select({ ownerId: businesses.ownerId })
    .from(businesses)
    .where(eq(businesses.id, id))
  return row?.ownerId ?? null
}

test("user B takes over a business owned by user A", async () => {
  await expect(ownerIdOf("biz-taken")).resolves.toBe("user-a")
  await expect(claimBusinessForUser("user-b", "taken-shop")).resolves.toEqual({
    ok: true,
    businessId: "biz-taken",
  })
  await expect(ownerIdOf("biz-taken")).resolves.toBe("user-b")
})

test("claiming your own business is ok", async () => {
  await expect(claimBusinessForUser("user-b", "taken-shop")).resolves.toEqual({
    ok: true,
    businessId: "biz-taken",
  })
  await expect(ownerIdOf("biz-taken")).resolves.toBe("user-b")
})

test("unknown slug returns not_found", async () => {
  await expect(
    claimBusinessForUser("user-b", "no-such-shop")
  ).resolves.toEqual({ ok: false, error: "not_found" })
})
