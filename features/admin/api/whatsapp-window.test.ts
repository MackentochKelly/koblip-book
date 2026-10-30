// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  businesses,
  chatConnections,
  chatReplies,
  koblipChatConnection,
  platformSettingChanges,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))

const { getWhatsappWindow } = await import("./whatsapp-window")
const { removeWindowEntry } = await import("./whatsapp-window-actions")

let dir: string
let closeDb: () => void

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-whatsapp-window-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db
    .insert(user)
    .values({ id: "admin", name: "Admin", email: "admin@example.com", emailVerified: false })
  await db.insert(businesses).values(
    ["Shop", "Studio"].map((name) => ({
      id: name.toLowerCase(),
      slug: name.toLowerCase(),
      name,
      timezone: "America/Santo_Domingo",
      currency: "DOP",
    }))
  )
  // Both businesses share one workspace and number.
  await db.insert(chatConnections).values(
    ["shop", "studio"].map((businessId) => ({
      businessId,
      workspaceId: "w1",
      workspaceName: "Shared",
      scopes: "contacts",
      phoneNumberId: "p1",
    }))
  )
  await db.insert(koblipChatConnection).values({
    id: "koblip",
    workspaceId: "wk",
    workspaceName: "Koblip",
    scopes: "contacts",
    phoneNumberId: "pk",
  })
  await db.insert(chatReplies).values([
    { workspaceId: "w1", phoneNumberId: "p1", customerPhone: "18095550101", lastReplyAt: ago(30) },
    { workspaceId: "wk", phoneNumberId: "pk", customerPhone: "18095550102", lastReplyAt: ago(1) },
    { workspaceId: "gone", phoneNumberId: "p9", customerPhone: "18095550103", lastReplyAt: ago(2) },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("each customer who wrote: which number, newest first, open inside 24 hours", async () => {
  const { entries } = await getWhatsappWindow()
  expect(entries.map(({ customerPhone, number, open }) => [customerPhone, number, open])).toEqual([
    ["18095550102", { kind: "koblip" }, true],
    ["18095550103", { kind: "unknown" }, true],
    ["18095550101", { kind: "own", businesses: ["Shop", "Studio"] }, false],
  ])
})

test("removing an entry deletes it and logs who removed what", async () => {
  const entry = { workspaceId: "wk", phoneNumberId: "pk", customerPhone: "18095550102" }
  expect(await removeWindowEntry(entry)).toEqual({ ok: true })
  expect((await getWhatsappWindow()).entries.map(({ customerPhone }) => customerPhone)).toEqual([
    "18095550103",
    "18095550101",
  ])
  const [change] = await db.select().from(platformSettingChanges)
  expect(change).toMatchObject({
    key: "whatsapp.window.remove",
    businessId: null,
    before: { ...entry, lastReplyAt: expect.any(String) },
    after: null,
    changedBy: "admin",
  })

  // Gone already: nothing more is logged.
  expect(await removeWindowEntry(entry)).toEqual({ ok: true })
  expect(await removeWindowEntry({ ...entry, customerPhone: 1 } as never)).toEqual({ ok: false })
  expect(await db.select().from(platformSettingChanges)).toHaveLength(1)
})
