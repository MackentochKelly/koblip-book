// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businessSettings, businesses } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

// "pro" pays for Pro; "free" doesn't.
vi.mock("@/lib/plan-access", () => ({
  businessPlan: vi.fn(async (id: string) => (id === "pro" ? "pro" : "free")),
}))

const { koblipTemplateLimit } = await import("./koblip-usage")
const { notificationRules } = await import("./platform-settings")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-usage-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(businesses).values(
    ["free", "pro"].map((id) => ({ id, slug: id, name: id, timezone: "UTC", currency: "USD" }))
  )
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("each plan has its own monthly templates, and a business's own limit wins", async () => {
  // The defaults: 30 on Free, 200 on Pro (O4).
  const rules = await notificationRules()
  expect(await koblipTemplateLimit("free", rules)).toBe(30)
  expect(await koblipTemplateLimit("pro", rules)).toBe(200)

  await db.insert(businessSettings).values({ businessId: "pro", key: "koblipMonthlyTemplates", value: 5 })
  expect(await koblipTemplateLimit("pro", rules)).toBe(5)
})
