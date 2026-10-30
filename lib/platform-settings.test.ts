// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, user } from "@/lib/db/schema"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"

vi.mock("server-only", () => ({}))

const {
  RuleValueError,
  notificationRuleChanges,
  notificationRuleSettings,
  notificationRules,
  setNotificationRule,
} = await import("./platform-settings")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-platform-settings-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({ id: "admin", name: "Admin", email: "admin@example.com", emailVerified: false })
  await db.insert(businesses).values([
    { id: "a", slug: "a", name: "A", timezone: "America/Santo_Domingo", currency: "DOP" },
    { id: "b", slug: "b", name: "B", timezone: "America/Santo_Domingo", currency: "DOP" },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("with nothing saved, the rules are the defaults in code", async () => {
  expect(await notificationRules()).toEqual(NOTIFICATION_RULES)
  expect(await notificationRules("a")).toEqual(NOTIFICATION_RULES)
})

test("the admin's value overrides the default for everyone, and is logged", async () => {
  await setNotificationRule({ key: "historySize", value: 50, userId: "admin" })
  expect((await notificationRules()).historySize).toBe(50)
  expect((await notificationRules("a")).historySize).toBe(50)
  const [change] = await notificationRuleChanges()
  expect(change).toMatchObject({ key: "historySize", businessId: null, before: null, after: 50, changedBy: "admin" })
  const setting = (await notificationRuleSettings()).find((rule) => rule.key === "historySize")
  expect(setting).toEqual({ key: "historySize", defaultValue: 30, value: 50, perBusiness: false })
})

test("a business's own limit wins over everyone's, only for that business", async () => {
  await setNotificationRule({ key: "koblipMonthlyTemplates", value: 500, userId: "admin" })
  await setNotificationRule({ key: "koblipMonthlyTemplates", value: 1000, userId: "admin", businessId: "a" })
  expect((await notificationRules("a")).koblipMonthlyTemplates).toBe(1000)
  expect((await notificationRules("b")).koblipMonthlyTemplates).toBe(500)
  expect((await notificationRules()).koblipMonthlyTemplates).toBe(500)
})

test("reset goes back to the default and logs it; saving the same value logs nothing", async () => {
  const before = (await notificationRuleChanges()).length
  await setNotificationRule({ key: "historySize", value: null, userId: "admin" })
  expect((await notificationRules()).historySize).toBe(NOTIFICATION_RULES.historySize)
  await setNotificationRule({ key: "historySize", value: null, userId: "admin" })
  const changes = await notificationRuleChanges()
  expect(changes).toHaveLength(before + 1)
  expect(changes[0]).toMatchObject({ key: "historySize", before: 50, after: null })
})

test("a value outside its rule, an unknown rule, or a per-business value for a rule that has none is refused", async () => {
  const refuse = (change: Parameters<typeof setNotificationRule>[0]) =>
    expect(setNotificationRule(change)).rejects.toBeInstanceOf(RuleValueError)
  await refuse({ key: "maxButtons", value: 4, userId: "admin" })
  await refuse({ key: "freeTextMinutes", value: 24 * 60 + 1, userId: "admin" })
  await refuse({ key: "defaultQuietStart", value: "25:00", userId: "admin" })
  await refuse({ key: "defaultCantCome", value: "ignore", userId: "admin" })
  await refuse({ key: "defaultReminders", value: [0], userId: "admin" })
  await refuse({ key: "nope" as "historySize", value: 1, userId: "admin" })
  await refuse({ key: "historySize", value: 40, userId: "admin", businessId: "a" })
  expect((await notificationRules()).maxButtons).toBe(NOTIFICATION_RULES.maxButtons)
})
