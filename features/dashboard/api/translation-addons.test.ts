// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import {
  addonGroups,
  addonOptions,
  businesses,
  serviceAddonGroups,
  services,
  translations,
  user,
} from "@/lib/db/schema"

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
const { getTranslationStatus } = await import("./translation-queries")

let closeDb: () => void
let dir: string

function fresh() {
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  vi.stubEnv("MODEL_API_KEY", "test-key")
  vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "")
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

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translate-addons-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values({
    id: "biz-ta",
    slug: "ta-shop",
    name: "TA Shop",
    description: "About us",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  await db.insert(services).values({
    id: "svc-1",
    businessId: "biz-ta",
    name: "Cut",
    description: "Neat",
    durationMinutes: 30,
    position: 0,
  })
  await db.insert(addonGroups).values({
    id: "g1",
    businessId: "biz-ta",
    name: "Extras",
    prompt: "Choose extras",
    minSelect: 0,
    maxSelect: null,
    position: 0,
  })
  await db.insert(addonOptions).values({
    id: "o1",
    businessId: "biz-ta",
    groupId: "g1",
    name: "Conditioner",
    description: "Nice smell",
    durationMinutes: 15,
    priceMinor: 500,
    position: 0,
  })
  await db.insert(serviceAddonGroups).values({
    businessId: "biz-ta",
    serviceId: "svc-1",
    groupId: "g1",
    position: 0,
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("status counts the add-on texts", async () => {
  fresh()
  // About + service name + service description + group prompt +
  // option name + option description.
  expect(await getTranslationStatus("biz-ta")).toEqual({
    language: "es",
    enabled: true,
    total: 6,
    upToDate: 0,
  })
})

test("translateBusiness covers the add-on texts", async () => {
  fresh()
  expect(await translateBusiness("biz-ta")).toEqual({
    ok: true,
    translated: 6,
  })
  const { db } = await import("@/lib/db")
  const rows = await db
    .select({ entityId: translations.entityId, field: translations.field })
    .from(translations)
  expect(
    rows
      .filter((row) => row.entityId === "g1" || row.entityId === "o1")
      .map((row) => [row.entityId, row.field])
      .sort()
  ).toEqual([
    ["g1", "addon_group.prompt"],
    ["o1", "addon.description"],
    ["o1", "addon.name"],
  ])
})

test("a renamed option goes stale, removed groups lose their rows", async () => {
  fresh()
  const { db } = await import("@/lib/db")
  await db
    .update(addonOptions)
    .set({ name: "Conditioner Plus" })
    .where(eq(addonOptions.id, "o1"))
  expect(await getTranslationStatus("biz-ta")).toMatchObject({
    total: 6,
    upToDate: 5,
  })
  await db.delete(addonGroups).where(eq(addonGroups.id, "g1"))
  const result = await translateBusiness("biz-ta")
  expect(result.ok).toBe(true)
  const rows = await db.select().from(translations)
  expect(rows.some((row) => row.entityId === "g1")).toBe(false)
  expect(rows.some((row) => row.entityId === "o1")).toBe(false)
  expect(rows.some((row) => row.entityId === "svc-1")).toBe(true)
})
