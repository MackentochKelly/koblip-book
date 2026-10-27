// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { emailStatus } = await import("./email-status")

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-email-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })

  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

test("emailStatus rejects bad input", async () => {
  for (const email of ["", "ab", "no-at-all", `${"a".repeat(250)}@b.co`]) {
    await expect(emailStatus(email)).resolves.toEqual({ ok: false })
  }
})

test("emailStatus finds an existing address regardless of case", async () => {
  await expect(emailStatus("owner@example.com")).resolves.toEqual({
    ok: true,
    exists: true,
  })
  await expect(emailStatus("Owner@Example.COM")).resolves.toEqual({
    ok: true,
    exists: true,
  })
  await expect(emailStatus("  owner@example.com  ")).resolves.toEqual({
    ok: true,
    exists: true,
  })
})

test("emailStatus reports a missing address", async () => {
  await expect(emailStatus("nobody@example.com")).resolves.toEqual({
    ok: true,
    exists: false,
  })
})
