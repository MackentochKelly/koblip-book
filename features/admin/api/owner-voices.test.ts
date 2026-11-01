// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { ownerVoices, user } from "@/lib/db/schema"

const { getAccountVoices } = vi.hoisted(() => ({ getAccountVoices: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))
vi.mock("@/lib/account-voices", () => ({ getAccountVoices }))
const { getOwners } = await import("./queries")
const { requireAdmin } = await import("@/lib/dal")
let dir: string
let db: (typeof import("@/lib/db"))["db"]
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-owner-voices-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "o@x.com" },
    { id: "u2", name: "Other", email: "p@x.com" },
    { id: "guest", name: "Guest", email: "g@x.com", isAnonymous: true },
  ])
  await db.insert(ownerVoices).values([
    { ownerId: "u1", voiceId: "v1" },
    { ownerId: "guest", voiceId: "v2" },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
beforeEach(() => {
  vi.clearAllMocks()
  getAccountVoices.mockResolvedValue([{ voiceId: "v1", name: "Ana" }])
})
test("admin sees the saved id and its current account name, or no choice", async () => {
  const owners = await getOwners()
  expect(requireAdmin).toHaveBeenCalledOnce()
  expect(owners).toHaveLength(2)
  expect(owners.find((owner) => owner.id === "u1")?.voice).toEqual({
    voiceId: "v1",
    name: "Ana",
  })
  expect(owners.find((owner) => owner.id === "u2")?.voice).toBeNull()
  expect(getAccountVoices).toHaveBeenCalledOnce()
})
test.each([[], null])(
  "a removed or unavailable voice keeps its saved id visible to admin",
  async (voices) => {
    getAccountVoices.mockResolvedValue(voices)
    const owners = await getOwners()
    expect(owners.find((owner) => owner.id === "u1")?.voice).toEqual({
      voiceId: "v1",
      name: null,
    })
  }
)
