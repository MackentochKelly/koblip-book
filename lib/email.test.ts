// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"

import { db } from "@/lib/db"
import { emailBlocks, emailSends, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { createTransportMock, sendMailMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}))

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}))

const SES_ENV = {
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "test-key",
  AWS_SECRET_ACCESS_KEY: "test-secret",
  EMAIL_FROM: "Koblip <contact@koblip.com>",
}

const MESSAGE = { to: "Owner@Example.com", subject: "s", text: "t", html: "<p>t</p>" }

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-email-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(user)
    .values({ id: "owner", name: "Owner", email: "owner@example.com", emailVerified: true })
})

beforeEach(async () => {
  await db.delete(emailBlocks)
  await db.delete(emailSends)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

async function freshEmail() {
  vi.resetModules()
  createTransportMock.mockReset()
  sendMailMock.mockReset()
  sendMailMock.mockResolvedValue({ response: "ses-message-1" })
  createTransportMock.mockReturnValue({ sendMail: sendMailMock })
  return import("./email")
}

function setUp(more: Record<string, string> = {}) {
  for (const [key, value] of Object.entries({ ...SES_ENV, ...more })) {
    vi.stubEnv(key, value)
  }
}

test("without SES keys it warns once, logs the email as not set up, and never throws", async () => {
  vi.stubEnv("AWS_ACCESS_KEY_ID", "")
  const { sendEmail } = await freshEmail()
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

  await expect(sendEmail(MESSAGE, { kind: "verification", userId: "owner" })).resolves.toBe(false)
  await expect(sendEmail(MESSAGE, { kind: "verification", userId: "owner" })).resolves.toBe(false)

  expect(createTransportMock).not.toHaveBeenCalled()
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledWith("Email is not set up")
  const rows = await db.select().from(emailSends)
  expect(rows.map((row) => [row.state, row.reason, row.email])).toEqual([
    ["skipped", "notSetUp", "owner@example.com"],
    ["skipped", "notSetUp", "owner@example.com"],
  ])
  warn.mockRestore()
})

test("with SES keys it sends through one SES transport and logs Amazon's id", async () => {
  setUp({ SES_CONFIGURATION_SET: "koblip-book" })
  const { sendEmail } = await freshEmail()

  await expect(
    sendEmail(MESSAGE, { kind: "verification", userId: "owner", language: "en" })
  ).resolves.toBe(true)
  await sendEmail({ ...MESSAGE, to: "other@example.com" }, { kind: "resetPassword" })

  expect(createTransportMock).toHaveBeenCalledTimes(1)
  const options = createTransportMock.mock.calls[0]?.[0] as { SES: { sesClient: unknown } }
  expect(options.SES.sesClient).toBeDefined()
  expect(sendMailMock).toHaveBeenCalledWith({
    from: "Koblip <contact@koblip.com>",
    to: "Owner@Example.com",
    subject: "s",
    text: "t",
    html: "<p>t</p>",
    ses: { ConfigurationSetName: "koblip-book" },
  })
  const rows = await db.select().from(emailSends)
  const first = rows.find((row) => row.kind === "verification")
  expect(first).toMatchObject({
    state: "sent",
    messageId: "ses-message-1",
    email: "owner@example.com",
    userId: "owner",
    language: "en",
  })
  expect(first?.sentAt).toBeTruthy()
})

test("a blocked address is skipped, never sent", async () => {
  setUp()
  const { sendEmail } = await freshEmail()
  await db.insert(emailBlocks).values({ email: "owner@example.com", reason: "bounce" })

  await expect(sendEmail(MESSAGE, { kind: "verification" })).resolves.toBe(false)

  expect(sendMailMock).not.toHaveBeenCalled()
  const [row] = await db.select().from(emailSends)
  expect([row?.state, row?.reason]).toEqual(["skipped", "blocked"])
})

test("a send failure only logs its message and is kept as failed", async () => {
  setUp()
  const { sendEmail } = await freshEmail()
  sendMailMock.mockRejectedValueOnce(new Error("ses down"))
  const error = vi.spyOn(console, "error").mockImplementation(() => {})

  await expect(sendEmail(MESSAGE, { kind: "verification" })).resolves.toBe(false)

  expect(error).toHaveBeenCalledWith("ses down")
  const [row] = await db.select().from(emailSends)
  expect([row?.state, row?.reason]).toEqual(["failed", "sendFailed"])
  error.mockRestore()
})
