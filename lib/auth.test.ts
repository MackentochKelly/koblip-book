// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { user } from "@/lib/db/schema"

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
