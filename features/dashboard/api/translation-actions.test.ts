// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businesses, services, translations, user } from "@/lib/db/schema"

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

const { translateBusiness } = await import("./translation-actions")

let closeDb: () => void
let dir: string

function fresh() {
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  vi.stubEnv("MODEL_API_KEY", "test-key")
  // Answer every asked id with a short Spanish text.
  createMock.mockImplementation(async (request: {
    messages: { content: string }[]
  }) => {
    const content = request.messages[1]?.content ?? "[]"
    const asked = JSON.parse(content.slice(content.indexOf("["))) as {
      id: string
      text: string
    }[]
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: asked.map((item) => ({
                id: item.id,
                text: `ES ${item.text}`,
              })),
            }),
          },
        },
      ],
    }
  })
}

async function rows() {
  const { db } = await import("@/lib/db")
  return db.select().from(translations)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translate-action-test-"))
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
    id: "biz-t",
    slug: "t-shop",
    name: "T Shop",
    description: "About us",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  await db.insert(services).values({
    id: "svc-1",
    businessId: "biz-t",
    name: "Cut",
    description: "Neat",
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

test("translates everything missing, then reports nothing to do", async () => {
  fresh()
  const first = await translateBusiness("biz-t")
  expect(first).toEqual({ ok: true, translated: 3 })
  expect(
    (await rows())
      .map((row) => [row.entityId, row.field] as [string, string])
      .sort()
  ).toEqual([
    ["biz-t", "business.description"],
    ["svc-1", "service.description"],
    ["svc-1", "service.name"],
  ])
  const second = await translateBusiness("biz-t")
  expect(second).toEqual({ ok: true, translated: 0 })
  expect(createMock).toHaveBeenCalledTimes(1)
})

test("retranslates a changed text through the upsert", async () => {
  fresh()
  const { db } = await import("@/lib/db")
  await db
    .update(services)
    .set({ name: "Cut Deluxe" })
    .where(eq(services.id, "svc-1"))
  const result = await translateBusiness("biz-t")
  expect(result).toEqual({ ok: true, translated: 1 })
  const updated = await db
    .select()
    .from(translations)
    .where(eq(translations.entityId, "svc-1"))
  expect(
    updated.find((row) => row.field === "service.name")
  ).toMatchObject({ sourceText: "Cut Deluxe", text: "ES Cut Deluxe" })
})

test("deletes rows whose service no longer exists", async () => {
  fresh()
  const { db } = await import("@/lib/db")
  await db.delete(services).where(eq(services.id, "svc-1"))
  const result = await translateBusiness("biz-t")
  expect(result.ok).toBe(true)
  expect(
    (await rows()).some((row) => row.entityId === "svc-1")
  ).toBe(false)
})

test("returns ai_off when the key is missing", async () => {
  fresh()
  vi.stubEnv("MODEL_API_KEY", "")
  expect(await translateBusiness("biz-t")).toEqual({
    ok: false,
    error: "ai_off",
  })
  expect(createMock).not.toHaveBeenCalled()
})

test("returns failed when the AI errors", async () => {
  fresh()
  createMock.mockRejectedValueOnce(new Error("boom"))
  const { db } = await import("@/lib/db")
  await db.insert(services).values({
    id: "svc-new",
    businessId: "biz-t",
    name: "Fresh",
    durationMinutes: 30,
    position: 0,
  })
  expect(await translateBusiness("biz-t")).toEqual({
    ok: false,
    error: "failed",
  })
})

test("returns not_found for someone else's business", async () => {
  fresh()
  expect(await translateBusiness("biz-theirs")).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(createMock).not.toHaveBeenCalled()
})
