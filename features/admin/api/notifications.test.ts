// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, inAppNotificationSettings, inAppNotifications, user } from "@/lib/db/schema"
import { notificationFilterFrom, notificationQuery } from "../utils/notification-filter"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin", name: "Admin", email: "admin@example.com" })),
}))

const { getAdminNotifications } = await import("./notifications")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-admin-notifications-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({ id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false })
  const business = (id: string, name: string, more = {}) => ({
    id,
    slug: id,
    name,
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
    ...more,
  })
  await db
    .insert(businesses)
    .values([business("b", "Barber"), business("a", "Atelier"), business("demo", "Demo", { isDemo: true })])
  const at = (minute: number) => `2026-11-02T14:0${minute}:00.000Z`
  await db.insert(inAppNotifications).values([
    { businessId: "a", kind: "newBooking", data: { customerName: "Ana" }, link: "/dashboard/a", createdAt: at(1) },
    {
      businessId: "a",
      kind: "messageFailed",
      data: {},
      link: "/dashboard/a/notifications/activity",
      readAt: at(3),
      createdAt: at(2),
    },
    { businessId: "b", kind: "newBooking", data: {}, link: "/dashboard/b", createdAt: at(3) },
  ])
  await db.insert(inAppNotificationSettings).values([
    { businessId: "a", turnedOff: ["customerReplied"] },
    { businessId: "b", turnedOff: [] },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("every stored notification, newest first, with filters; the owners' turned-off kinds", async () => {
  const all = await getAdminNotifications({})
  expect(all.rows.map(({ businessName, kind, read }) => [businessName, kind, read])).toEqual([
    ["Barber", "newBooking", false],
    ["Atelier", "messageFailed", true],
    ["Atelier", "newBooking", false],
  ])
  expect(all.businesses).toEqual([
    { id: "a", name: "Atelier" },
    { id: "b", name: "Barber" },
  ])
  expect(all.choices).toEqual([{ businessId: "a", businessName: "Atelier", turnedOff: ["customerReplied"] }])

  const ids = async (filter: Parameters<typeof getAdminNotifications>[0]) =>
    (await getAdminNotifications(filter)).rows.map(({ businessId, kind }) => `${businessId}:${kind}`)
  expect(await ids({ businessId: "a" })).toEqual(["a:messageFailed", "a:newBooking"])
  expect(await ids({ kind: "newBooking" })).toEqual(["b:newBooking", "a:newBooking"])
  expect(await ids({ read: "read" })).toEqual(["a:messageFailed"])
  expect(await ids({ businessId: "a", read: "unread" })).toEqual(["a:newBooking"])
})

test("the filters live in the address; unknown values are ignored", () => {
  const filter = notificationFilterFrom({ business: "a", kind: "newBooking", read: "unread" })
  expect(filter).toEqual({ businessId: "a", kind: "newBooking", read: "unread" })
  expect(notificationQuery(filter)).toBe("?business=a&kind=newBooking&read=unread")
  expect(notificationFilterFrom({ kind: "nope", read: ["read"] })).toEqual({
    businessId: undefined,
    kind: undefined,
    read: undefined,
  })
  expect(notificationQuery({})).toBe("")
})
