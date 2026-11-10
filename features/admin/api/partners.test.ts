// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { partnerApps, partnerInvites } from "@/lib/db/schema"
import { hashSecret } from "@/lib/partner-keys"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))

const { addPartnerApp, updatePartnerApp, revokePartnerApp } = await import(
  "./partner-actions"
)
const { getPartners } = await import("./partners")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-partners-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

test("an app is added with its key stored only as a hash", async () => {
  const made = await addPartnerApp({
    name: " Sales ",
    webhookUrl: "https://sales.example.com/hooks/book",
    dailyInvites: 20,
  })
  if (!made.ok) throw new Error("not added")
  expect(made.key).toMatch(/^kbk_/)
  expect(made.eventSecret).toMatch(/^kbe_/)
  const [row] = await db.select().from(partnerApps)
  expect(row.name).toBe("Sales")
  expect(row.keyHash).toBe(hashSecret(made.key))
  expect(row.keyHash).not.toContain(made.key)
  expect(row.keyHint).toBe(made.key.slice(-4))
  expect(row.dailyInvites).toBe(20)
})

test("a bad webhook, name or cap is refused", async () => {
  for (const input of [
    { name: "A", webhookUrl: "http://sales.example.com", dailyInvites: 5 },
    { name: "A", webhookUrl: "https://u:p@sales.example.com", dailyInvites: 5 },
    { name: "", webhookUrl: "", dailyInvites: 5 },
    { name: "A", webhookUrl: "", dailyInvites: 0 },
    { name: "A", webhookUrl: "", dailyInvites: 1.5 },
    { name: "A", webhookUrl: "", dailyInvites: 5000 },
  ]) {
    expect(await addPartnerApp(input)).toEqual({ ok: false, error: "invalid" })
  }
  // While developing, http to this machine is allowed.
  expect(
    (
      await addPartnerApp({
        name: "Local",
        webhookUrl: "http://localhost:3001/hook",
        dailyInvites: 5,
      })
    ).ok
  ).toBe(true)
})

test("an app changes, then is revoked for good; the list shows its invites", async () => {
  const [app] = await db
    .select()
    .from(partnerApps)
    .where(eq(partnerApps.name, "Sales"))
  expect(
    await updatePartnerApp(app.id, {
      name: "Sales",
      webhookUrl: "",
      dailyInvites: 30,
    })
  ).toEqual({ ok: true })
  await db.insert(partnerInvites).values({
    appId: app.id,
    codeHash: "h1",
    placeId: "ChIJ0000000000",
    ref: "lead-1",
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(await revokePartnerApp(app.id)).toEqual({ ok: true })
  expect(await revokePartnerApp(app.id)).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(
    await updatePartnerApp(app.id, {
      name: "Sales",
      webhookUrl: "",
      dailyInvites: 30,
    })
  ).toEqual({ ok: false, error: "not_found" })
  const { apps, invites } = await getPartners()
  const listed = apps.find((row) => row.id === app.id)
  expect(listed).toMatchObject({ webhookUrl: null, dailyInvites: 30, invites: 1 })
  expect(listed?.revokedAt).not.toBeNull()
  expect(invites[0]).toMatchObject({ ref: "lead-1", state: "revoked" })
})
