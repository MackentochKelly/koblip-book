// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  businesses,
  notificationSettings,
  notificationTexts,
  platformSettingChanges,
  user,
} from "@/lib/db/schema"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))

const {
  resetBusinessSettings,
  resetBusinessWording,
  setBusinessMessageOn,
  turnOffBusinessWhatsapp,
} = await import("./whatsapp-business-actions")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-whatsapp-business-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db
    .insert(user)
    .values({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      emailVerified: false,
    })
  await db.insert(businesses).values([
    {
      id: "a",
      slug: "a",
      name: "A",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
    },
    {
      id: "b",
      slug: "b",
      name: "B",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
    },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const settingsOf = async (businessId: string) =>
  (
    await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.businessId, businessId))
  )[0]
const changes = () => db.select().from(platformSettingChanges)

test("turning a message off makes the settings from the defaults and logs it", async () => {
  expect(await setBusinessMessageOn("a", "reminder", false)).toEqual({
    ok: true,
  })
  const row = await settingsOf("a")
  expect(row.turnedOff).toEqual(["reminder"])
  expect(row.reminders).toEqual(NOTIFICATION_RULES.defaultReminders)
  const [change] = await changes()
  expect(change).toMatchObject({
    key: "whatsapp.turnedOff",
    businessId: "a",
    before: [],
    after: ["reminder"],
    changedBy: "admin",
  })

  expect(await setBusinessMessageOn("a", "reminder", true)).toEqual({
    ok: true,
  })
  expect((await settingsOf("a")).turnedOff).toEqual([])
})

test("nothing changes, and nothing is logged, for a message or business that does not exist", async () => {
  const before = (await changes()).length
  expect(await setBusinessMessageOn("a", "nope" as "reminder", false)).toEqual({
    ok: false,
  })
  expect(await setBusinessMessageOn("missing", "reminder", false)).toEqual({
    ok: false,
  })
  expect(await setBusinessMessageOn("a", "reminder", true)).toEqual({
    ok: true,
  })
  expect((await changes()).length).toBe(before)
})

test("turning WhatsApp off turns every message off", async () => {
  expect(await turnOffBusinessWhatsapp("b")).toEqual({ ok: true })
  expect((await settingsOf("b")).turnedOff).toHaveLength(
    notificationTexts.message.enumValues.length
  )
})

test("resetting settings brings back the defaults but keeps the owner's number and what is off", async () => {
  await db
    .update(notificationSettings)
    .set({
      reminders: [60],
      quietStart: "22:00",
      thankYouReply: false,
      ownerPhone: "+18095550100",
    })
    .where(eq(notificationSettings.businessId, "b"))
  expect(await resetBusinessSettings("b")).toEqual({ ok: true })
  const row = await settingsOf("b")
  expect(row.reminders).toEqual(NOTIFICATION_RULES.defaultReminders)
  expect(row.quietStart).toBe(NOTIFICATION_RULES.defaultQuietStart)
  expect(row.thankYouReply).toBe(true)
  expect(row.ownerPhone).toBe("+18095550100")
  expect(row.turnedOff).toHaveLength(
    notificationTexts.message.enumValues.length
  )
  expect((await changes()).at(-1)).toMatchObject({
    key: "whatsapp.settings",
    businessId: "b",
  })
})

test("resetting wording removes the business's own, in both languages, and logs what it was", async () => {
  const text = {
    businessId: "a",
    message: "confirmed" as const,
    header: "Hi",
    body: "Booked {service}",
    footer: "A",
  }
  await db.insert(notificationTexts).values([
    { ...text, language: "en" },
    { ...text, language: "es" },
    { ...text, message: "reminder", language: "en" },
  ])
  expect(await resetBusinessWording("a", "confirmed")).toEqual({ ok: true })
  const left = await db.select().from(notificationTexts)
  expect(left.map((row) => row.message)).toEqual(["reminder"])
  const last = (await changes()).at(-1)
  expect(last).toMatchObject({
    key: "whatsapp.wording.confirmed",
    businessId: "a",
    after: null,
  })
  expect(last?.before).toHaveLength(2)
})
