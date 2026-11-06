// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { session, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}))

vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }))

let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-auth-verify-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef-test"
  process.env.BETTER_AUTH_URL = "http://test.local/api/auth"

  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  // The emails' words: English from code, Spanish from the migrated
  // database.
  const { registerEnglishWords } = await import("@/lib/translations/interface-words")
  registerEnglishWords((await import("@/i18n/messages")).default)
})

afterAll(() => {
  vi.unstubAllEnvs()
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

function sentHtml(): string {
  expect(sendEmailMock).toHaveBeenCalledTimes(1)
  const call = sendEmailMock.mock.calls[0]?.[0] as
    | { to: string; subject: string; html: string }
    | undefined
  expect(call?.to).toBe("new-owner@example.com")
  expect(call?.subject).toBe("Confirm your email")
  return call?.html ?? ""
}

test("email sign-up sends a verification link", async () => {
  const { auth } = await import("./auth")

  await auth.api.signUpEmail({
    body: {
      name: "New Owner",
      email: "new-owner@example.com",
      password: "password123",
    },
    headers: new Headers(),
  })

  expect(sentHtml()).toContain("/api/auth/verify-email")
})

test("following the verification link verifies the email", async () => {
  const { auth } = await import("./auth")
  const { db } = await import("@/lib/db")

  const token = new URL(
    sentHtml().match(/https?:\/\/[^\s"'<>]+/)?.[0] ?? ""
  ).searchParams.get("token")
  expect(token).toBeTruthy()

  await auth.api.verifyEmail({
    query: { token: token as string },
    headers: new Headers(),
  })

  const [row] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, "new-owner@example.com"))
  expect(row?.emailVerified).toBe(true)
})

function sentLink(): string {
  const call = sendEmailMock.mock.calls.at(-1)?.[0] as
    | { text: string }
    | undefined
  return call?.text.match(/https?:\/\/\S+/)?.[0] ?? ""
}

test("a reset link replaces the password, ends old sessions and confirms the email", async () => {
  const { auth } = await import("./auth")
  const { db } = await import("@/lib/db")
  const email = "stuck-owner@example.com"

  const signedUp = await auth.api.signUpEmail({
    body: { name: "Stuck Owner", email, password: "old-password-123" },
    headers: new Headers(),
  })
  const [before] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email))
  expect(before?.emailVerified).toBe(false)

  sendEmailMock.mockClear()
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password?lang=en" },
    headers: new Headers(),
  })
  const token = new URL(sentLink()).pathname.split("/").at(-1) as string
  expect(token).toBeTruthy()

  await auth.api.resetPassword({
    body: { newPassword: "new-password-123", token },
    headers: new Headers(),
  })

  const [after] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email))
  expect(after?.emailVerified).toBe(true)
  await expect(
    db.select().from(session).where(eq(session.userId, signedUp.user.id))
  ).resolves.toEqual([])
  await expect(
    auth.api.signInEmail({
      body: { email, password: "old-password-123" },
      headers: new Headers(),
    })
  ).rejects.toThrow()
  await expect(
    auth.api.signInEmail({
      body: { email, password: "new-password-123" },
      headers: new Headers(),
    })
  ).resolves.toMatchObject({ user: { email } })
})

test("a reset link works once", async () => {
  const { auth } = await import("./auth")
  const email = "stuck-owner@example.com"

  sendEmailMock.mockClear()
  await auth.api.requestPasswordReset({ body: { email }, headers: new Headers() })
  const token = new URL(sentLink()).pathname.split("/").at(-1) as string
  await auth.api.resetPassword({
    body: { newPassword: "another-password-123", token },
    headers: new Headers(),
  })
  await expect(
    auth.api.resetPassword({
      body: { newPassword: "stolen-password-123", token },
      headers: new Headers(),
    })
  ).rejects.toThrow()
})

test.each([
  ["owner-lang=es", "en-US", "Confirma tu correo"],
  ["owner-lang=en", "es-MX", "Confirm your email"],
  ["", "es-MX", "Confirma tu correo"],
  ["", "fr", "Confirm your email"],
])("the email follows the owner's pick, then the phone: cookie %j, phone %j", async (cookie, phone, subject) => {
  const { auth } = await import("./auth")

  sendEmailMock.mockClear()
  await auth.handler(
    new Request("http://test.local/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://test.local",
        cookie,
        "accept-language": phone,
      },
      body: JSON.stringify({
        name: "New Owner",
        email: `${crypto.randomUUID()}@example.com`,
        password: "password123",
      }),
    })
  )
  const call = sendEmailMock.mock.calls.at(-1)?.[0] as { subject: string }
  expect(call.subject).toBe(subject)
})
