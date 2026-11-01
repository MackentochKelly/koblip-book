// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { ownerVoices, user } from "@/lib/db/schema"
import { VOICE_RULES } from "@/lib/voice-rules"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: vi.fn() }))
vi.mock("@/lib/account-voices", () => ({ isAccountVoice: vi.fn() }))
const { getSession } = await import("@/lib/dal")
const { isAccountVoice } = await import("@/lib/account-voices")
const { saveOwnerVoice } = await import("./voice-actions")
let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-voice-actions-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "o@x.com" },
    { id: "u2", name: "Guest", email: "g@x.com", isAnonymous: true },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ userId: "u1" } as never)
  vi.mocked(isAccountVoice).mockImplementation(async (id) =>
    ["v1", "v2"].includes(id)
  )
  await db.delete(ownerVoices)
})

test("no session is unauthorized", async () => {
  vi.mocked(getSession).mockResolvedValue(null)
  expect(await saveOwnerVoice("v1")).toEqual({
    ok: false,
    error: "unauthorized",
  })
  expect(isAccountVoice).not.toHaveBeenCalled()
  expect(await db.select().from(ownerVoices)).toEqual([])
})

test.each([
  null,
  undefined,
  1,
  {},
  "",
  " ",
  "v".repeat(VOICE_RULES.maxVoiceIdLength + 1),
])("invalid voice %j is refused before lookup", async (voiceId) => {
  expect(await saveOwnerVoice(voiceId)).toEqual({
    ok: false,
    error: "unknown_voice",
  })
  expect(isAccountVoice).not.toHaveBeenCalled()
  expect(await db.select().from(ownerVoices)).toEqual([])
})

test("an unknown voice is refused", async () => {
  expect(await saveOwnerVoice("other")).toEqual({
    ok: false,
    error: "unknown_voice",
  })
  expect(await db.select().from(ownerVoices)).toEqual([])
})

test("saving then changing updates one row with an updated timestamp", async () => {
  expect(await saveOwnerVoice("v1")).toEqual({ ok: true })
  await db.update(ownerVoices).set({ updatedAt: "2000-01-01T00:00:00.000Z" })
  expect(await saveOwnerVoice("v2")).toEqual({ ok: true })
  const rows = await db.select().from(ownerVoices)
  expect(rows).toEqual([
    { ownerId: "u1", voiceId: "v2", updatedAt: expect.any(String) },
  ])
  expect(rows[0].updatedAt).not.toBe("2000-01-01T00:00:00.000Z")
})

test("demo guests can save their own choice without changing another owner's", async () => {
  await saveOwnerVoice("v1")
  vi.mocked(getSession).mockResolvedValue({
    userId: "u2",
    isGuest: true,
  } as never)
  expect(await saveOwnerVoice("v2")).toEqual({ ok: true })
  expect(await db.select().from(ownerVoices)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ ownerId: "u1", voiceId: "v1" }),
      expect.objectContaining({ ownerId: "u2", voiceId: "v2" }),
    ])
  )
  await db.delete(user).where(eq(user.id, "u2"))
  expect(await db.select().from(ownerVoices)).toHaveLength(1)
})
