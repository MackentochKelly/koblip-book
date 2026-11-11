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
  emailBlocks,
  emailSends,
  notificationSends,
  notificationSettings,
  planFeatures,
  user,
} from "@/lib/db/schema"

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ response: "ses-id" })),
}))

vi.mock("server-only", () => ({}))
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}))

const { registerEnglishWords } = await import("@/lib/translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)
const { runBookingEmails } = await import("./email-sender")
const { readStopToken, stopEmails, stopLinks } = await import("@/lib/email-stop")
const { emailActivity } = await import("@/lib/email-activity")
const { BOOKING_EMAILS } = await import("@/lib/email-rules")

type Mail = {
  from: string | { name: string; address: string }
  to: string
  subject: string
  text: string
  attachments?: { filename: string; content: string }[]
  list?: { unsubscribe: string }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
// Noon UTC, outside the default quiet hours (21:00 to 08:00).
const NOW = new Date("2026-11-12T12:00:00.000Z")
let dir: string

// A booking at 15:00 three days from now, made five minutes ago.
function booking(id: string, more: Partial<typeof bookings.$inferInsert> = {}) {
  const start = Date.parse("2026-11-15T15:00:00.000Z")
  const made = new Date(NOW.getTime() - 5 * MINUTE).toISOString()
  return {
    id,
    businessId: "shop",
    serviceName: "Haircut",
    durationMinutes: 30,
    priceMinor: 2500,
    currency: "USD",
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + 30 * MINUTE).toISOString(),
    customerName: "Ana",
    customerEmail: "ana@example.com",
    createdAt: made,
    updatedAt: made,
    ...more,
  }
}

function mails(): Mail[] {
  return sendMail.mock.calls.map((call) => (call as unknown as [Mail])[0])
}

async function rows(bookingId?: string) {
  const all = await db.select().from(emailSends)
  return all.filter((row) => !bookingId || row.bookingId === bookingId)
}

beforeAll(async () => {
  process.env.BETTER_AUTH_URL = "https://book.example.com"
  process.env.BETTER_AUTH_SECRET = "test-secret-for-email-stop"
  process.env.AWS_REGION = "us-east-1"
  process.env.AWS_ACCESS_KEY_ID = "test-key"
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret"
  process.env.EMAIL_FROM = "Koblip Book <contact@koblip.com>"
  dir = mkdtempSync(join(tmpdir(), "koblip-email-sender-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "Owner", email: "owner@example.com", emailVerified: true },
    { id: "ana", name: "Ana", email: "ana@example.com", emailVerified: true },
  ])
  await db.insert(businesses).values({
    id: "shop",
    slug: "shop",
    name: "Shop",
    address: "1 Main St",
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
  })
})

beforeEach(async () => {
  sendMail.mockClear()
  await db.delete(emailBlocks)
  await db.delete(emailSends)
  await db.delete(notificationSends)
  await db.delete(clientNotificationSettings)
  await db.delete(notificationSettings)
  await db.delete(planFeatures)
  await db.delete(bookings)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a new online booking: the customer's confirmation and the owner's email, each once", async () => {
  await db.insert(bookings).values(booking("b1", { customerUserId: "ana" }))
  await runBookingEmails(NOW)
  await runBookingEmails(NOW)

  const sent = mails()
  expect(sent.map((mail) => mail.to).sort()).toEqual(["ana@example.com", "owner@example.com"])
  const confirmation = sent.find((mail) => mail.to === "ana@example.com")!
  expect(confirmation.subject).toBe("Booking confirmed: Haircut at Shop")
  expect(confirmation.from).toEqual({ name: "Shop", address: "contact@koblip.com" })
  expect(confirmation.text).toContain("https://book.example.com/account/bookings/b1")
  expect(confirmation.attachments?.[0]?.content).toContain("UID:b1@koblip.com")
  expect(confirmation.list?.unsubscribe).toContain("https://book.example.com/api/email/stop?t=")
  const toOwner = sent.find((mail) => mail.to === "owner@example.com")!
  expect(toOwner.subject).toBe("New booking: Ana, Haircut")
  expect(toOwner.from).toBe("Koblip Book <contact@koblip.com>")
  expect(toOwner.list).toBeUndefined()

  const kinds = (await rows("b1")).map((row) => [row.kind, row.state, row.reminderMinutes])
  expect(kinds.filter(([, state]) => state === "sent").sort()).toEqual([
    ["bookingConfirmed", "sent", 0],
    ["ownerNewBooking", "sent", 0],
  ])
})

test("reminders go by email at the business's times when WhatsApp can't reach the booking", async () => {
  await db.insert(bookings).values([
    booking("no-phone"),
    booking("whatsapp", { customerPhone: "+18095550134", whatsappOptIn: true, source: "owner" }),
    booking("picked", {
      customerUserId: "ana",
      customerPhone: "+18095550134",
      whatsappOptIn: true,
      source: "owner",
    }),
  ])
  await db
    .insert(clientNotificationSettings)
    .values({ userId: "ana", turnedOff: [], reminderChannel: "email" })
  await runBookingEmails(NOW)

  const reminders = (await rows()).filter((row) => row.kind === "clientReminder")
  // The longest and the shortest that fit (1440 and 30 minutes), waiting.
  expect(reminders.map((row) => [row.bookingId, row.reminderMinutes, row.dueAt, row.state]).sort()).toEqual([
    ["no-phone", 1440, "2026-11-14T15:00:00.000Z", "pending"],
    ["no-phone", 30, "2026-11-15T14:30:00.000Z", "pending"],
    ["picked", 1440, "2026-11-14T15:00:00.000Z", "pending"],
    ["picked", 30, "2026-11-15T14:30:00.000Z", "pending"],
  ])

  // A day before, the first one goes.
  await runBookingEmails(new Date("2026-11-14T15:00:30.000Z"))
  const sent = mails().filter((mail) => mail.subject.startsWith("Reminder"))
  expect(sent).toHaveLength(2)
})

test("a move after the confirmation: 'Booking changed', and the old reminders don't go", async () => {
  await db.insert(bookings).values(booking("b1", { source: "owner" }))
  await runBookingEmails(NOW)
  await db
    .update(bookings)
    .set({ moves: 1, startAt: "2026-11-16T15:00:00.000Z", endAt: "2026-11-16T15:30:00.000Z" })
    .where(eq(bookings.id, "b1"))
  await runBookingEmails(NOW)
  await runBookingEmails(new Date("2026-11-14T15:00:30.000Z"))

  const subjects = mails().map((mail) => mail.subject)
  expect(subjects).toContain("Booking changed: Haircut at Shop")
  const old = (await rows("b1")).filter((row) => row.kind === "clientReminder" && row.moves === 0)
  expect(old.find((row) => row.reminderMinutes === 1440)).toMatchObject({ state: "skipped", reason: "moved" })
})

test("a cancel after the confirmation: 'Booking cancelled' with Book again; reminders are skipped", async () => {
  await db.insert(bookings).values(booking("b1", { source: "owner" }))
  await runBookingEmails(NOW)
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, "b1"))
  await runBookingEmails(NOW)
  await runBookingEmails(new Date("2026-11-14T15:00:30.000Z"))

  const cancelled = mails().find((mail) => mail.subject.startsWith("Booking cancelled"))!
  expect(cancelled.text).toContain("Book again: https://book.example.com/b/shop")
  expect(mails().some((mail) => mail.subject.startsWith("Reminder"))).toBe(false)
  const skipped = (await rows("b1")).filter((row) => row.kind === "clientReminder")
  expect(skipped.every((row) => row.state === "skipped" && row.reason === "cancelled")).toBe(true)
})

test("bookings made before the window, and demo businesses, get no confirmation", async () => {
  await db.insert(bookings).values(
    booking("old", { createdAt: new Date(NOW.getTime() - 2 * HOUR).toISOString(), source: "owner" })
  )
  await runBookingEmails(NOW)
  expect((await rows("old")).some((row) => row.kind === "bookingConfirmed")).toBe(false)
})

test("the owner hears that a customer can't come", async () => {
  await db.insert(bookings).values(booking("b1", { source: "owner" }))
  await db.insert(notificationSends).values({
    businessId: "shop",
    bookingId: "b1",
    moves: 0,
    dueAt: NOW.toISOString(),
    message: "ownerCantCome",
    state: "skipped",
    reason: "noOwnerPhone",
    createdAt: NOW.toISOString(),
  })
  await runBookingEmails(NOW)
  const mail = mails().find((sent) => sent.to === "owner@example.com")!
  expect(mail.subject).toBe("Ana can't come: Haircut")
})

test("Stop emails: a signed link stops that business's emails to that address", async () => {
  const { page } = stopLinks("Ana@Example.com", "shop")
  const token = decodeURIComponent(new URL(page).searchParams.get("t")!)
  expect(readStopToken(token)).toEqual({ email: "ana@example.com", businessId: "shop" })
  expect(readStopToken(token.replace(/.$/, (last) => (last === "A" ? "B" : "A")))).toBeNull()
  expect(await stopEmails(token)).toBe(true)
  expect(await stopEmails(token)).toBe(true)

  await db.insert(bookings).values(booking("b1", { source: "owner" }))
  await runBookingEmails(NOW)
  expect(mails()).toHaveLength(0)
  const [row] = await rows("b1")
  expect([row?.state, row?.reason]).toEqual(["skipped", "blocked"])
})

test("an email the owner turned off is kept as not sent, and the history shows why", async () => {
  await db.insert(notificationSettings).values({
    businessId: "shop",
    reminders: [1440],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
    emailTurnedOff: ["bookingConfirmed"],
  })
  await db.insert(bookings).values([
    booking("b1", { customerUserId: "ana" }),
    booking("b2", { customerName: "Bo_b", customerEmail: "bob@example.com", customerUserId: null }),
  ])
  await runBookingEmails(NOW)

  // The owner's email still goes; the confirmations don't.
  expect(mails().map((mail) => mail.to)).toEqual(["owner@example.com", "owner@example.com"])
  const confirmations = (await rows()).filter((row) => row.kind === "bookingConfirmed")
  expect(confirmations.map((row) => [row.state, row.reason])).toEqual([
    ["skipped", "turnedOff"],
    ["skipped", "turnedOff"],
  ])

  // Filtered by email and state, and searched by name (LIKE's "_" taken
  // literally) or address.
  const off = await emailActivity({ businessId: "shop", kinds: BOOKING_EMAILS }, { kind: "bookingConfirmed", state: "skipped" }, 30)
  expect(off.map((row) => row.reason)).toEqual(["turnedOff", "turnedOff"])
  const bob = await emailActivity({ businessId: "shop", kinds: BOOKING_EMAILS }, { search: "o_b" }, 30)
  expect(bob.every((row) => row.customerName === "Bo_b")).toBe(true)
  expect(bob.length).toBeGreaterThan(0)
  expect(await emailActivity({ businessId: "shop", kinds: BOOKING_EMAILS }, { search: "oxb" }, 30)).toEqual([])
  const byAddress = await emailActivity({ businessId: "shop", kinds: BOOKING_EMAILS }, { search: "ANA@" }, 30)
  expect(byAddress.every((row) => row.email === "ana@example.com")).toBe(true)
  expect(await emailActivity({ businessId: "other", kinds: BOOKING_EMAILS }, {}, 30)).toEqual([])
})

test("email reminders moved to Pro: a Free business's reminders are kept as not sent", async () => {
  await db.insert(planFeatures).values({ featureKey: "emailReminders", plan: "pro", updatedBy: "owner" })
  await db.insert(bookings).values(booking("b1", { source: "owner" }))
  await runBookingEmails(NOW)
  await runBookingEmails(new Date("2026-11-14T15:00:30.000Z"))

  expect(mails().some((mail) => mail.subject.startsWith("Reminder"))).toBe(false)
  expect(mails().some((mail) => mail.subject.startsWith("Booking confirmed"))).toBe(true)
  const reminder = (await rows("b1")).find((row) => row.kind === "clientReminder" && row.reminderMinutes === 1440)
  expect([reminder?.state, reminder?.reason]).toEqual(["skipped", "notOnPlan"])
})
