// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  businesses,
  services,
  translations,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not-found")
  }),
}))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { getTranslationStatus } = await import("./translation-queries")

let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translate-status-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  vi.stubEnv("MODEL_API_KEY", "test-key")
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
    id: "biz-q",
    slug: "q-shop",
    name: "Q Shop",
    description: "About us",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  await db.insert(services).values({
    id: "svc-q",
    businessId: "biz-q",
    name: "Cut",
    description: null,
    durationMinutes: 30,
    position: 0,
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("counts total texts and up-to-date translations", async () => {
  expect(await getTranslationStatus("biz-q")).toEqual({
    language: "es",
    enabled: true,
    total: 2,
    upToDate: 0,
  })
  const { db } = await import("@/lib/db")
  await db.insert(translations).values({
    businessId: "biz-q",
    entityId: "svc-q",
    field: "service.name",
    language: "es",
    sourceText: "Cut",
    text: "Corte",
  })
  expect(await getTranslationStatus("biz-q")).toEqual({
    language: "es",
    enabled: true,
    total: 2,
    upToDate: 1,
  })
})

test("reports disabled when Meta AI is off", async () => {
  vi.stubEnv("MODEL_API_KEY", "")
  const status = await getTranslationStatus("biz-q")
  expect(status.enabled).toBe(false)
  expect(status.total).toBe(2)
  vi.stubEnv("MODEL_API_KEY", "test-key")
})
