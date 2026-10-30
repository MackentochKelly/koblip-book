// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  businesses,
  chatConnections,
  koblipChatConnection,
  notificationSettings,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { offersWhatsapp } = await import("./whatsapp-offer")

let dir: string
let closeDb: () => void

const SCOPES = "contacts templates automations conversations"

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-whatsapp-offer-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db
    .insert(user)
    .values({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    })
})

beforeEach(async () => {
  await db.delete(notificationSettings)
  await db.delete(chatConnections)
  await db.delete(koblipChatConnection)
  await db.delete(businesses)
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function connectOwn(
  values: Partial<typeof chatConnections.$inferInsert> = {}
) {
  await db.insert(chatConnections).values({
    businessId: "biz",
    workspaceId: "w1",
    workspaceName: "Shop",
    scopes: SCOPES,
    phoneNumberId: "p1",
    ...values,
  })
}

async function connectKoblip(
  values: Partial<typeof koblipChatConnection.$inferInsert> = {}
) {
  await db.insert(koblipChatConnection).values({
    id: "koblip",
    workspaceId: "wk",
    workspaceName: "Koblip",
    scopes: SCOPES,
    phoneNumberId: "pk",
    ...values,
  })
}

test("no number can send: no consent asked", async () => {
  expect(await offersWhatsapp("biz")).toBe(false)
  await connectOwn({ phoneNumberId: null })
  await connectKoblip({ needsReconnect: true })
  expect(await offersWhatsapp("biz")).toBe(false)
})

test("the business's own number asks for consent", async () => {
  await connectOwn()
  expect(await offersWhatsapp("biz")).toBe(true)
})

test("Koblip's number asks for consent for a business with an owner, never a demo", async () => {
  await connectKoblip()
  expect(await offersWhatsapp("biz")).toBe(true)
  await db.update(businesses).set({ isDemo: true })
  expect(await offersWhatsapp("biz")).toBe(false)
  await db.update(businesses).set({ isDemo: false, ownerId: null })
  expect(await offersWhatsapp("biz")).toBe(false)
  expect(await offersWhatsapp("missing")).toBe(false)
})

test("every customer message turned off: no consent asked", async () => {
  await connectKoblip()
  await db.insert(notificationSettings).values({
    businessId: "biz",
    reminders: [1440],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: ["confirmed", "reminder", "changed", "cancelled"],
  })
  expect(await offersWhatsapp("biz")).toBe(false)
})
