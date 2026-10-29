// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }))

let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-admin-access-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef-test"
  process.env.BETTER_AUTH_URL = "http://test.local/api/auth"
  process.env.ADMIN_USER_IDS = " boss , other-boss"

  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    { id: "boss", name: "Boss", email: "boss@example.com", emailVerified: true },
    { id: "owner", name: "Owner", email: "owner@example.com", emailVerified: true },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function isAdmin(userId: string) {
  const { auth } = await import("@/lib/auth")
  const { success } = await auth.api.userHasPermission({
    body: { userId, permissions: { user: ["list"] } },
  })
  return success
}

test("only the accounts in ADMIN_USER_IDS are admins", async () => {
  expect(await isAdmin("boss")).toBe(true)
  expect(await isAdmin("owner")).toBe(false)
})
