// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, inAppNotificationSettings, inAppNotifications, user } from "@/lib/db/schema"

let signedIn: string | null = "u1"
const refresh = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ refresh, revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({ userId: signedIn })),
}))

const { notification, notify } = await import("@/lib/in-app-notifications")
const { saveAll } = await import("@/lib/db/save-all")
const { getNotificationPage, getUnreadCount } = await import("./queries")
const { markAllNotificationsRead, markNotificationRead } = await import("./actions")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-in-app-notifications-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values(
    ["u1", "u2"].map((id) => ({ id, name: id, email: `${id}@example.com`, emailVerified: false }))
  )
  const business = (id: string, ownerId: string, more = {}) => ({
    id,
    slug: id,
    name: id.toUpperCase(),
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId,
    ...more,
  })
  await db
    .insert(businesses)
    .values([business("a", "u1"), business("b", "u1"), business("c", "u2"), business("demo", "u1", { isDemo: true })])
})

beforeEach(async () => {
  signedIn = "u1"
  refresh.mockClear()
  await db.delete(inAppNotifications)
  await db.delete(inAppNotificationSettings)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a notification opens its place; demo copies and turned-off kinds get none", async () => {
  await notify("a", "newBooking", { customerName: "Ana", serviceName: "Cut" })
  await notify("a", "messageFailed", { customerName: "Ana", message: "reminder" })
  await notify("demo", "newBooking", { customerName: "Ana" })
  await db.insert(inAppNotificationSettings).values({ businessId: "b", turnedOff: ["newBooking"] })
  await notify("b", "newBooking", { customerName: "Ana" })
  await notify("b", "connectionRenew", {})

  const rows = await db.select().from(inAppNotifications)
  expect(rows.map(({ businessId, kind, link }) => [businessId, kind, link]).sort()).toEqual([
    ["a", "messageFailed", "/dashboard/a/auto-messages/activity"],
    ["a", "newBooking", "/dashboard/a"],
    ["b", "connectionRenew", "/dashboard/b/integrations"],
  ])
  // Saved with what caused it: nothing when none is due.
  expect(await notification("demo", "newBooking", {})).toEqual([])
})

test("a key makes repeats one; with renew the one comes back unread with the latest facts", async () => {
  await notify("a", "koblipLimitNear", { sent: 240 }, { dedupeKey: "near:2026-11" })
  await notify("a", "koblipLimitNear", { sent: 250 }, { dedupeKey: "near:2026-11" })
  expect((await db.select().from(inAppNotifications)).map(({ data }) => data)).toEqual([{ sent: 240 }])

  await notify("a", "customerReplied", { customerName: "Ana" }, { dedupeKey: "replied:1809", renew: true })
  await markAllNotificationsRead()
  await saveAll(
    await notification("a", "customerReplied", { customerName: "Ana P." }, { dedupeKey: "replied:1809", renew: true })
  )
  const replied = (await db.select().from(inAppNotifications)).filter(({ kind }) => kind === "customerReplied")
  expect(replied).toHaveLength(1)
  expect(replied[0]).toMatchObject({ data: { customerName: "Ana P." }, readAt: null })
})

test("the bell lists the owner's businesses only, newest first, in pages", async () => {
  const at = (minute: number) => `2026-11-02T14:${String(minute).padStart(2, "0")}:00.000Z`
  await db.insert(inAppNotifications).values([
    ...Array.from({ length: 22 }, (_, minute) => ({
      businessId: minute % 2 ? "a" : "b",
      kind: "newBooking" as const,
      data: { customerName: `C${minute}` },
      link: "/dashboard/a",
      createdAt: at(minute),
    })),
    { businessId: "c", kind: "newBooking" as const, data: {}, link: "/dashboard/c", createdAt: at(59) },
  ])

  const first = await getNotificationPage()
  expect(first.items).toHaveLength(20)
  expect(first.items[0]).toMatchObject({
    data: { customerName: "C21" },
    businessName: "A",
    timezone: "America/Santo_Domingo",
    read: false,
  })
  const second = await getNotificationPage(first.nextCursor!)
  expect(second.items.map(({ data }) => data.customerName)).toEqual(["C1", "C0"])
  expect(second.nextCursor).toBeNull()
  expect(await getUnreadCount()).toBe(22)

})

test("marking read: one of the owner's own, or all of them; the page refreshes", async () => {
  await notify("a", "newBooking", {})
  await notify("c", "newBooking", {})
  const [mine] = await db.select().from(inAppNotifications).where(eqBusiness("a"))
  const [theirs] = await db.select().from(inAppNotifications).where(eqBusiness("c"))

  expect(await markNotificationRead(theirs.id)).toEqual({ ok: false, error: "not_found" })
  expect(await markNotificationRead(mine.id)).toEqual({ ok: true })
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(await getUnreadCount()).toBe(0)

  await notify("b", "newBooking", {})
  await notify("b", "connectionRenew", {})
  expect(await getUnreadCount()).toBe(2)
  expect(await markAllNotificationsRead()).toEqual({ ok: true })
  expect(await getUnreadCount()).toBe(0)
  signedIn = "u2"
  expect(await getUnreadCount()).toBe(1)
})

function eqBusiness(businessId: string) {
  return eq(inAppNotifications.businessId, businessId)
}
