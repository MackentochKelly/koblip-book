// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { bookings, businesses, notificationSends, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { cancelWaitingWrite, sendAgainWrite } = await import("./whatsapp-sends")
const { whatsappActivity, whatsappActivityStats } = await import("./whatsapp-activity")

let dir: string
let closeDb: () => void
let count = 0

const ahead = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

async function send(row: {
  businessId?: string
  state: "pending" | "sending" | "sent" | "failed" | "skipped"
  startAt?: string
  status?: "confirmed" | "cancelled"
  message?: "confirmed" | "cancelled"
}) {
  const { db } = await import("@/lib/db")
  count += 1
  const businessId = row.businessId ?? "b1"
  const startAt = row.startAt ?? ahead
  await db.insert(bookings).values({
    id: `bk-${count}`,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt,
    endAt: startAt,
    customerName: `Customer ${count}`,
    status: row.status ?? "confirmed",
  })
  await db.insert(notificationSends).values({
    id: `ns-${count}`,
    businessId,
    bookingId: `bk-${count}`,
    message: row.message ?? "confirmed",
    dueAt: past,
    state: row.state,
  })
  return `ns-${count}`
}

async function stateOf(id: string) {
  const { db } = await import("@/lib/db")
  const { eq } = await import("drizzle-orm")
  const [row] = await db.select().from(notificationSends).where(eq(notificationSends.id, id))
  return { state: row.state, reason: row.reason }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-sends-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: true,
  })
  for (const [id, name] of [
    ["b1", "Shop One"],
    ["b2", "Shop Two"],
  ]) {
    await db.insert(businesses).values({
      id,
      slug: id,
      name,
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    })
  }
})

afterEach(async () => {
  const { db } = await import("@/lib/db")
  await db.delete(notificationSends)
  await db.delete(bookings)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("send again puts a failed message back in line, only for its business", async () => {
  const id = await send({ state: "failed" })
  expect(await sendAgainWrite(id, "b2")).toEqual({ ok: false, error: "not_found" })
  const again = await sendAgainWrite(id)
  if (!again.ok) throw new Error(again.error)
  await again.write
  expect(await stateOf(id)).toEqual({ state: "pending", reason: null })
})

test("send again refuses what is not failed, cancelled or late", async () => {
  expect(await sendAgainWrite(await send({ state: "sent" }))).toEqual({
    ok: false,
    error: "notFailed",
  })
  expect(await sendAgainWrite(await send({ state: "failed", status: "cancelled" }))).toEqual({
    ok: false,
    error: "cancelled",
  })
  expect(
    (await sendAgainWrite(await send({ state: "failed", status: "cancelled", message: "cancelled" })))
      .ok
  ).toBe(true)
  expect(await sendAgainWrite(await send({ state: "failed", startAt: past }))).toEqual({
    ok: false,
    error: "late",
  })
})

test("cancel keeps a waiting message as not sent, and only a waiting one", async () => {
  const id = await send({ state: "pending" })
  const cancel = await cancelWaitingWrite(id)
  if (!cancel.ok) throw new Error(cancel.error)
  await cancel.write
  expect(await stateOf(id)).toEqual({ state: "skipped", reason: "adminCancelled" })
  expect(await cancelWaitingWrite(id)).toEqual({ ok: false, error: "notWaiting" })
  expect(await cancelWaitingWrite(await send({ state: "sending" }))).toEqual({
    ok: false,
    error: "notWaiting",
  })
})

test("activity lists every business with its name and time zone, or one", async () => {
  await send({ state: "sent", businessId: "b1" })
  await send({ state: "failed", businessId: "b2" })
  const all = await whatsappActivity({}, { limit: 10 })
  expect(all.map((row) => row.businessName).sort()).toEqual(["Shop One", "Shop Two"])
  expect(all[0].timeZone).toBe("America/Santo_Domingo")
  const one = await whatsappActivity({ state: "failed" }, { businessId: "b1", limit: 10 })
  expect(one).toEqual([])
})

test("stats count the last days, each matching one Activity filter", async () => {
  const { db } = await import("@/lib/db")
  const { eq } = await import("drizzle-orm")
  const read = await send({ state: "sent" })
  await db
    .update(notificationSends)
    .set({ delivery: "read", replyAction: "confirm", repliedAt: past })
    .where(eq(notificationSends.id, read))
  await send({ state: "sent" })
  await send({ state: "failed" })
  const old = await send({ state: "failed" })
  await db
    .update(notificationSends)
    .set({ dueAt: new Date(Date.now() - 30 * 86_400_000).toISOString() })
    .where(eq(notificationSends.id, old))
  expect(await whatsappActivityStats("b1", 7)).toEqual({ sent: 2, read: 1, replied: 1, failed: 1 })
  const ids = async (state: "read" | "replied") =>
    (await whatsappActivity({ state }, { businessId: "b1", limit: 10 })).map((row) => row.id)
  expect(await ids("read")).toEqual([read])
  expect(await ids("replied")).toEqual([read])
})
