// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businesses, teamInvites, teamMembers, user } from "@/lib/db/schema"
vi.mock("server-only", () => ({}))
process.env.BETTER_AUTH_URL = "https://book.example"
const { createTeamInvite, joinWithTeamInvite, readTeamInvite } = await import("./team-invites")
let dir: string
let db: (typeof import("@/lib/db"))["db"]
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "team-invites-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "Owner", email: "owner@example.com" },
    { id: "ana", name: "Ana", email: "ana@example.com" },
    { id: "luis", name: "Luis", email: "luis@example.com" },
  ])
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
  })
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Ana" },
    { id: "m2", businessId: "biz", name: "Bea" },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

const tokenOf = (url: string) => url.split("/join/")[1]

test("a link joins once, and a newer link ends the older one", async () => {
  const old = tokenOf((await createTeamInvite({ businessId: "biz", teamMemberId: "m1", createdBy: "owner" })).url)
  const { url } = await createTeamInvite({ businessId: "biz", teamMemberId: "m1", createdBy: "owner" })
  expect(url.startsWith("https://book.example/join/")).toBe(true)
  expect(await readTeamInvite(old)).toBeNull()
  const token = tokenOf(url)
  expect(await readTeamInvite(token)).toMatchObject({ businessName: "Shop", memberName: "Ana", state: "ready", joined: false })
  expect(await joinWithTeamInvite(token, "ana")).toEqual({ ok: true, teamMemberId: "m1" })
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, "m1"))
  expect(member.userId).toBe("ana")
  expect(await joinWithTeamInvite(token, "luis")).toEqual({ ok: false, reason: "expired" })
})

test("an old link, a taken seat or a second seat in one business can't join", async () => {
  const late = tokenOf((await createTeamInvite({ businessId: "biz", teamMemberId: "m2", createdBy: "owner" })).url)
  await db.update(teamInvites).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(teamInvites.teamMemberId, "m2"))
  expect(await joinWithTeamInvite(late, "luis")).toEqual({ ok: false, reason: "expired" })

  const second = tokenOf((await createTeamInvite({ businessId: "biz", teamMemberId: "m2", createdBy: "owner" })).url)
  expect(await joinWithTeamInvite(second, "ana")).toEqual({ ok: false, reason: "already-member" })

  const taken = tokenOf((await createTeamInvite({ businessId: "biz", teamMemberId: "m1", createdBy: "owner" })).url)
  expect(await joinWithTeamInvite(taken, "luis")).toEqual({ ok: false, reason: "taken" })
  expect(await joinWithTeamInvite("nope", "luis")).toEqual({ ok: false, reason: "expired" })
})
