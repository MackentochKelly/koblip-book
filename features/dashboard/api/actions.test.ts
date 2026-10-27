// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, services, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { createMock, OpenAiMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  OpenAiMock: vi.fn(),
}))

vi.mock("openai", () => ({ default: OpenAiMock }))

const { suggestServices } = await import("./actions")

let closeDb: () => void
let dir: string

async function loadFresh() {
  vi.resetModules()
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  vi.stubEnv("MODEL_API_KEY", "test-key")
}

function reply(services: unknown[]) {
  return { choices: [{ message: { content: JSON.stringify({ services }) } }] }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-suggest-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values({
    id: "biz-mine",
    slug: "my-shop",
    name: "My Shop",
    category: "Barber shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  await db.insert(services).values({
    id: "svc-existing",
    businessId: "biz-mine",
    name: "Classic Cut",
    durationMinutes: 30,
    position: 0,
  })
  await db.insert(businesses).values({
    id: "biz-theirs",
    slug: "their-shop",
    name: "Their Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "other",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("snaps durations, drops duplicates and long names, caps at 8", async () => {
  await loadFresh()
  createMock.mockResolvedValue(
    reply([
      { name: "Beard Trim", description: "  Tidy up.  ", durationMinutes: 50 },
      { name: "classic cut", durationMinutes: 30 },
      { name: "x".repeat(81), durationMinutes: 30 },
      { name: "   ", durationMinutes: 30 },
      { name: "Deluxe", durationMinutes: 100 },
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Extra ${i}`,
        durationMinutes: 30,
      })),
    ])
  )
  const result = await suggestServices("biz-mine")
  expect(result.ok).toBe(true)
  if (!result.ok) {
    return
  }
  expect(result.services).toHaveLength(8)
  expect(result.services[0]).toEqual({
    name: "Beard Trim",
    description: "Tidy up.",
    durationMinutes: 45,
  })
  expect(result.services[1]).toEqual({
    name: "Deluxe",
    description: null,
    durationMinutes: 90,
  })
  expect(
    result.services.every((service) => service.name !== "classic cut")
  ).toBe(true)
})

test("returns ai_off when the key is missing", async () => {
  await loadFresh()
  vi.stubEnv("MODEL_API_KEY", "")
  const result = await suggestServices("biz-mine")
  expect(result).toEqual({ ok: false, error: "ai_off" })
  expect(createMock).not.toHaveBeenCalled()
})

test("returns failed when the AI errors", async () => {
  await loadFresh()
  createMock.mockRejectedValueOnce(new Error("boom"))
  const result = await suggestServices("biz-mine")
  expect(result).toEqual({ ok: false, error: "failed" })
})

test("returns not_found for someone else's business", async () => {
  await loadFresh()
  const result = await suggestServices("biz-theirs")
  expect(result).toEqual({ ok: false, error: "not_found" })
  expect(createMock).not.toHaveBeenCalled()
})
