// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  clientNotificationSettings,
  emailSends,
  user,
} from "@/lib/db/schema"

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ response: "ses-id" })),
}))

vi.mock("server-only", () => ({}))
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}))

const { registerEnglishWords } = await import("./translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)
const { emailClients, noWhatsappReminders } = await import("./client-reminders")

let dir: string
const HOUR = 3_600_000

// A visit starting `hoursAhead` from now, booked two days ago.
function visit(
  id: string,
  hoursAhead: number,
  more: Partial<typeof bookings.$inferInsert> = {}
) {
  const start = Date.now() + hoursAhead * HOUR
  const made = new Date(Date.now() - 48 * HOUR).toISOString()
  return {
    id,
    businessId: "shop",
    serviceName: "Haircut",
    durationMinutes: 30,
    currency: "USD",
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + HOUR).toISOString(),
    customerName: "x",
    createdAt: made,
    updatedAt: made,
    ...more,
  }
}

beforeAll(async () => {
  process.env.BETTER_AUTH_URL = "https://book.example.com"
  process.env.AWS_REGION = "us-east-1"
  process.env.AWS_ACCESS_KEY_ID = "test-key"
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret"
  process.env.EMAIL_FROM = "Koblip <contact@koblip.com>"
  dir = mkdtempSync(join(tmpdir(), "koblip-client-reminders-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "Owner", email: "o@example.com", emailVerified: true },
    { id: "ana", name: "Ana", email: "ana@example.com", emailVerified: true },
    {
      id: "ben",
      name: "Ben",
      email: "ben@example.com",
      emailVerified: true,
      phoneNumber: "+18095550134",
      phoneNumberVerified: true,
    },
    { id: "cy", name: "Cy", email: "cy@example.com", emailVerified: true },
  ])
  await db.insert(businesses).values({
    id: "shop",
    slug: "shop",
    name: "Shop",
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
  })
})

beforeEach(async () => {
  sendMail.mockClear()
  await db.delete(emailSends)
  await db.delete(clientNotificationSettings)
  await db.delete(bookings)
  // Ana and Ben (by the phone he proved) picked email; Cy the bell only.
  await db.insert(clientNotificationSettings).values([
    { userId: "ana", turnedOff: [], reminderChannel: "email" },
    { userId: "ben", turnedOff: [], reminderChannel: "email" },
    { userId: "cy", turnedOff: [], reminderChannel: "bell" },
  ])
  await db.insert(bookings).values([
    visit("ana-soon", 3, { customerUserId: "ana" }),
    visit("ana-later", 72, { customerUserId: "ana" }),
    visit("ana-off", 3, { customerUserId: "ana", status: "cancelled" }),
    visit("ben-soon", 3, { customerKey: "p:18095550134" }),
    visit("cy-soon", 3, { customerUserId: "cy" }),
    visit("guest-soon", 3, { customerKey: "p:1809" }),
  ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("an email reminder goes once, before the visit, to accounts that picked email", async () => {
  await emailClients()
  await emailClients()
  const sent = sendMail.mock.calls.map((call) => (call as unknown as [{ to: string; text: string }])[0])
  expect(sent.map((email) => email.to).sort()).toEqual(["ana@example.com", "ben@example.com"])
  expect(sent[0].text).toContain("https://book.example.com/account/bookings/")
  const rows = await db.select().from(emailSends)
  expect(rows.map((row) => [row.bookingId, row.kind, row.state, row.messageId]).sort()).toEqual([
    ["ana-soon", "clientReminder", "sent", "ses-id"],
    ["ben-soon", "clientReminder", "sent", "ses-id"],
  ])
  expect(rows.every((row) => row.businessId === "shop")).toBe(true)
})

test("a move gets its own reminder; a failed send is kept as failed", async () => {
  sendMail.mockRejectedValueOnce(new Error("ses down"))
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  await emailClients()
  const { eq } = await import("drizzle-orm")
  // Moved a day ago, before its reminder's time began.
  await db
    .update(bookings)
    .set({ moves: 1, updatedAt: new Date(Date.now() - 24 * HOUR).toISOString() })
    .where(eq(bookings.id, "ana-soon"))
  await emailClients()
  const rows = await db.select().from(emailSends).where(eq(emailSends.bookingId, "ana-soon"))
  expect(rows.map((row) => row.moves).sort()).toEqual([0, 1])
  expect((await db.select().from(emailSends)).some((row) => row.state === "failed")).toBe(true)
  error.mockRestore()
})

test("WhatsApp reminders skip bookings whose client picked another way", async () => {
  const skipped = (await noWhatsappReminders()).map((row) => row.id).sort()
  expect(skipped).toEqual(["ana-later", "ana-off", "ana-soon", "ben-soon", "cy-soon"])
  expect(skipped).not.toContain("guest-soon")
})
