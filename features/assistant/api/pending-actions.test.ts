// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-pending-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  const { businesses, user } = await import("@/lib/db/schema")
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "o@x.com", emailVerified: false },
    { id: "u2", name: "Other", email: "p@x.com", emailVerified: false },
  ])
  await db.insert(businesses).values([
    {
      id: "b1",
      slug: "salon",
      name: "Salon",
      timezone: "Europe/Madrid",
      currency: "EUR",
      ownerId: "u1",
    },
    {
      id: "b2",
      slug: "barber",
      name: "Barber",
      timezone: "Europe/Madrid",
      currency: "EUR",
      ownerId: "u2",
    },
  ])
})

afterAll(async () => {
  const { db } = await import("@/lib/db")
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  const { db } = await import("@/lib/db")
  const { assistantPendingActions } = await import("@/lib/db/schema")
  await db.delete(assistantPendingActions)
})

const { peekPendingAction, storePendingAction, takePendingAction } =
  await import("./pending-actions")

const BASE = {
  ownerId: "u1",
  businessId: "b1",
  toolName: "cancel_booking",
  args: { bookingId: "k1" },
}
const NOW = Date.UTC(2026, 9, 31, 12, 0, 0)

async function store(
  input: typeof BASE | (Omit<typeof BASE, "args"> & { args: unknown }) = BASE,
  now = NOW
): Promise<string> {
  const stored = await storePendingAction(input, now)
  if (!("id" in stored)) throw new Error("not stored")
  return stored.id
}

test("stores and takes once, with its args", async () => {
  const id = await store()
  expect(await peekPendingAction(id)).toMatchObject({
    toolName: "cancel_booking",
    args: { bookingId: "k1" },
  })
  expect(await takePendingAction(id, "u1", "b1", NOW)).toMatchObject({
    id,
    args: { bookingId: "k1" },
  })
  expect(await takePendingAction(id, "u1", "b1", NOW)).toBe("expired")
  expect(await peekPendingAction(id)).toBeNull()
})

test("survives a restart: a fresh module still finds the card", async () => {
  const id = await store()
  vi.resetModules()
  const fresh = await import("./pending-actions")
  expect(await fresh.takePendingAction(id, "u1", "b1", NOW)).toMatchObject({
    id,
  })
})

test("a double tap runs once", async () => {
  const id = await store()
  const taps = await Promise.all([
    takePendingAction(id, "u1", "b1", NOW),
    takePendingAction(id, "u1", "b1", NOW),
  ])
  expect(taps.filter((tap) => typeof tap === "object")).toHaveLength(1)
  expect(taps).toContain("expired")
})

test("expires after ten minutes and is removed", async () => {
  const id = await store()
  expect(await takePendingAction(id, "u1", "b1", NOW + 11 * 60_000)).toBe(
    "expired"
  )
  expect(await peekPendingAction(id)).toBeNull()
  const fresh = await store()
  expect(
    await takePendingAction(fresh, "u1", "b1", NOW + 9 * 60_000)
  ).toMatchObject({ id: fresh })
})

test("another owner's or business's card is refused and stays", async () => {
  const id = await store()
  expect(await takePendingAction(id, "u2", "b1", NOW)).toBe("not_allowed")
  expect(await takePendingAction(id, "u1", "b2", NOW)).toBe("not_allowed")
  expect(await peekPendingAction(id)).not.toBeNull()
})

test("caps waiting cards per owner; expired ones free room", async () => {
  for (let i = 0; i < 10; i += 1) {
    await store({ ...BASE, args: { n: i } })
  }
  expect(await storePendingAction(BASE, NOW + 1)).toEqual({
    error: "too_many",
  })
  // Two at once cannot both slip past the cap.
  const both = await Promise.all([
    storePendingAction(BASE, NOW + 1),
    storePendingAction(BASE, NOW + 1),
  ])
  expect(both).toEqual([{ error: "too_many" }, { error: "too_many" }])
  // Another owner still has room.
  expect("id" in (await storePendingAction({ ...BASE, ownerId: "u2" }, NOW))).toBe(
    true
  )
  // Ten minutes on, the old ones are gone and there is room again.
  expect("id" in (await storePendingAction(BASE, NOW + 11 * 60_000))).toBe(true)
})
