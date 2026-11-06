// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  clientNotificationSettings,
  inAppNotifications,
  user,
} from "@/lib/db/schema"

type Customer = { userId: string; name: string; phone: string | null }
let signedIn: Customer | null = null

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }))
vi.mock("@/lib/customer-dal", () => ({
  getCustomer: vi.fn(async () => signedIn),
}))

const { clientNotification, notify, remindClients } =
  await import("@/lib/in-app-notifications")
const { saveAll } = await import("@/lib/db/save-all")
const { clientFeedFor, getClientNotificationChoices, getClientReminderChoice } =
  await import("./client-queries")
const {
  markAllClientNotificationsRead,
  setClientNotificationChoice,
  setClientReminderChannel,
} = await import("./client-actions")
const { feedFor } = await import("./queries")

let dir: string
const HOUR = 3_600_000
const now = new Date("2026-11-06T12:00:00.000Z")

// Ana books with her account; Ben's account proved the phone an owner booked
// with; Cy has no account.
const ana: Customer = { userId: "ana", name: "Ana", phone: null }
const ben: Customer = { userId: "ben", name: "Ben", phone: "+18095550134" }

function booking(id: string, more: Partial<typeof bookings.$inferInsert> = {}) {
  return {
    id,
    businessId: "shop",
    serviceName: "Haircut",
    durationMinutes: 30,
    currency: "USD",
    startAt: new Date(now.getTime() + 48 * HOUR).toISOString(),
    endAt: new Date(now.getTime() + 49 * HOUR).toISOString(),
    customerName: "x",
    createdAt: new Date(now.getTime() - 72 * HOUR).toISOString(),
    updatedAt: new Date(now.getTime() - 72 * HOUR).toISOString(),
    ...more,
  }
}

async function tell(
  id: string,
  kind: "clientBooked" | "clientMoved" | "clientCancelled"
) {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  await saveAll(await clientNotification(row, kind))
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-client-notifications-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    {
      id: "owner",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: true,
    },
    { id: "ana", name: "Ana", email: "ana@example.com", emailVerified: true },
    {
      id: "ben",
      name: "Ben",
      email: "ben@example.com",
      emailVerified: true,
      phoneNumber: ben.phone,
      phoneNumberVerified: true,
    },
  ])
  await db.insert(businesses).values([
    {
      id: "shop",
      slug: "shop",
      name: "Shop",
      timezone: "UTC",
      currency: "USD",
      ownerId: "owner",
    },
    {
      id: "demo",
      slug: "demo",
      name: "Demo",
      timezone: "UTC",
      currency: "USD",
      ownerId: "owner",
      isDemo: true,
    },
  ])
})

beforeEach(async () => {
  signedIn = null
  await db.delete(inAppNotifications)
  await db.delete(clientNotificationSettings)
  await db.delete(bookings)
  await db
    .insert(bookings)
    .values([
      booking("a1", { customerUserId: "ana" }),
      booking("b1", { customerKey: "p:18095550134", customerPhone: ben.phone }),
      booking("c1", { customerKey: "p:18095550999" }),
      booking("d1", { businessId: "demo", customerUserId: "ana" }),
    ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a booking goes to the account that owns it, by account or proved phone", async () => {
  for (const id of ["a1", "b1", "c1", "d1"]) await tell(id, "clientBooked")
  const anaFeed = await clientFeedFor(ana)
  const benFeed = await clientFeedFor(ben)
  expect(anaFeed.unread).toBe(1)
  expect(anaFeed.page.items.map((item) => item.data.serviceName)).toEqual([
    "Haircut",
  ])
  expect(benFeed.unread).toBe(1)
  // No account owns c1, and a demo copy never tells anyone.
  expect(await db.select().from(inAppNotifications)).toHaveLength(2)
})

test("once per booking, kind and move; the owner's bell never shows them", async () => {
  await tell("a1", "clientCancelled")
  await tell("a1", "clientCancelled")
  await notify("shop", "newBooking", { customerName: "Ana" })
  expect((await clientFeedFor(ana)).unread).toBe(1)
  const owner = await feedFor("owner")
  expect(owner.page.items.map((item) => item.kind)).toEqual(["newBooking"])
})

test("a turned-off kind leaves the bell; read marks only the account's own", async () => {
  await tell("a1", "clientBooked")
  await tell("b1", "clientBooked")
  signedIn = ana
  expect(await setClientNotificationChoice("clientBooked", false)).toEqual({
    ok: true,
  })
  expect((await clientFeedFor(ana)).unread).toBe(0)
  expect(
    (await getClientNotificationChoices())?.find(
      (c) => c.kind === "clientBooked"
    )?.on
  ).toBe(false)
  await setClientNotificationChoice("clientBooked", true)
  await markAllClientNotificationsRead()
  expect((await clientFeedFor(ana)).unread).toBe(0)
  expect((await clientFeedFor(ben)).unread).toBe(1)
})

test("the reminder comes within the lead, once, not for a booking made inside it", async () => {
  const soon = new Date(now.getTime() + 3 * HOUR).toISOString()
  await db.insert(bookings).values([
    booking("a2", { customerUserId: "ana", startAt: soon, endAt: soon }),
    booking("a3", {
      customerUserId: "ana",
      startAt: soon,
      endAt: soon,
      updatedAt: new Date(now.getTime() - HOUR).toISOString(),
    }),
    booking("c2", { customerKey: "p:18095550999", startAt: soon, endAt: soon }),
  ])
  await remindClients(now)
  await remindClients(now)
  const items = (await clientFeedFor(ana)).page.items
  expect(items.map((item) => item.kind)).toEqual(["clientReminder"])
  expect(await db.select().from(inAppNotifications)).toHaveLength(1)
})

test("the client picks how reminders reach them; email needs a real email", async () => {
  signedIn = ana
  expect(await getClientReminderChoice()).toEqual({
    channel: "whatsapp",
    email: "ana@example.com",
  })
  expect(await setClientReminderChannel("pigeon")).toEqual({ ok: false, error: "invalid" })
  expect(await setClientReminderChannel("email")).toEqual({ ok: true })
  await setClientNotificationChoice("clientMoved", false)
  expect((await getClientReminderChoice())?.channel).toBe("email")

  await db
    .update(user)
    .set({ email: "18095550134@phone.invalid" })
    .where(eq(user.id, "ana"))
  expect((await getClientReminderChoice())?.email).toBeNull()
  expect(await setClientReminderChannel("email")).toEqual({ ok: false, error: "invalid" })
  expect(await setClientReminderChannel("bell")).toEqual({ ok: true })
  await db.update(user).set({ email: "ana@example.com" }).where(eq(user.id, "ana"))
})
