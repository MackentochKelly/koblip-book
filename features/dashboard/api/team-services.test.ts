// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import {
  businesses,
  services,
  teamMembers,
  teamMemberServices,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { planMemberServiceRows, planServiceTeamRows } = await import(
  "../utils/team-service-plan"
)
const { setMemberServices, setServiceTeam } = await import("./team-services")

test("planServiceTeamRows: empty or full team means no rows", () => {
  expect(planServiceTeamRows(["a", "b"], [])).toEqual({ ok: true, rows: [] })
  expect(planServiceTeamRows(["a", "b"], ["a", "b"])).toEqual({
    ok: true,
    rows: [],
  })
  expect(planServiceTeamRows(["a", "b"], ["b", "a"])).toEqual({
    ok: true,
    rows: [],
  })
})

test("planServiceTeamRows: a subset is stored as-is", () => {
  expect(planServiceTeamRows(["a", "b", "c"], ["b"])).toEqual({
    ok: true,
    rows: ["b"],
  })
})

test("planServiceTeamRows: duplicates and strangers are invalid", () => {
  expect(planServiceTeamRows(["a", "b"], ["a", "a"])).toEqual({
    ok: false,
    error: "invalid",
  })
  expect(planServiceTeamRows(["a", "b"], ["a", "zzz"])).toEqual({
    ok: false,
    error: "invalid",
  })
})

test("planMemberServiceRows: adding to a listed service unions the member", () => {
  const result = planMemberServiceRows({
    serviceIds: ["s1", "s2"],
    teamMemberIds: ["a", "b"],
    currentRows: { s1: ["a"] },
    teamMemberId: "b",
    serviceIdsWanted: ["s1", "s2"],
  })
  // s1 gains b (covering everyone would collapse to no rows, but here it
  // does cover everyone: a+b = the whole team, so s1 is left out).
  // s2 has no rows (everyone) and stays that way.
  expect(result).toEqual({ ok: true, rows: {} })
})

test("planMemberServiceRows: partial union keeps only the listed members", () => {
  const result = planMemberServiceRows({
    serviceIds: ["s1"],
    teamMemberIds: ["a", "b", "c"],
    currentRows: { s1: ["a"] },
    teamMemberId: "b",
    serviceIdsWanted: ["s1"],
  })
  expect(result).toEqual({ ok: true, rows: { s1: ["a", "b"] } })
})

test("planMemberServiceRows: leaving an everyone-service lists the others", () => {
  const result = planMemberServiceRows({
    serviceIds: ["s1", "s2"],
    teamMemberIds: ["a", "b"],
    currentRows: {},
    teamMemberId: "a",
    serviceIdsWanted: ["s2"],
  })
  expect(result).toEqual({ ok: true, rows: { s1: ["b"] } })
})

test("planMemberServiceRows: leaving a listed service removes the member", () => {
  const result = planMemberServiceRows({
    serviceIds: ["s1", "s2"],
    teamMemberIds: ["a", "b"],
    currentRows: { s1: ["a", "b"], s2: ["b"] },
    teamMemberId: "a",
    serviceIdsWanted: ["s2"],
  })
  // s1 drops to ["b"]; s2 gains a, covering everyone, so it collapses
  // back to no rows (everyone).
  expect(result).toEqual({ ok: true, rows: { s1: ["b"] } })
})

test("planMemberServiceRows: never strands a service with nobody", () => {
  const listed = planMemberServiceRows({
    serviceIds: ["s1"],
    teamMemberIds: ["a", "b"],
    currentRows: { s1: ["a"] },
    teamMemberId: "a",
    serviceIdsWanted: [],
  })
  expect(listed).toEqual({ ok: false, error: "last_member" })

  const solo = planMemberServiceRows({
    serviceIds: ["s1"],
    teamMemberIds: ["a"],
    currentRows: {},
    teamMemberId: "a",
    serviceIdsWanted: [],
  })
  expect(solo).toEqual({ ok: false, error: "last_member" })
})

test("planMemberServiceRows: unknown ids and duplicates are invalid", () => {
  const base = {
    serviceIds: ["s1"],
    teamMemberIds: ["a", "b"],
    currentRows: {},
    teamMemberId: "a",
    serviceIdsWanted: ["s1"],
  }
  expect(
    planMemberServiceRows({ ...base, serviceIdsWanted: ["nope"] })
  ).toEqual({ ok: false, error: "invalid" })
  expect(
    planMemberServiceRows({ ...base, serviceIdsWanted: ["s1", "s1"] })
  ).toEqual({ ok: false, error: "invalid" })
  expect(planMemberServiceRows({ ...base, teamMemberId: "zzz" })).toEqual({
    ok: false,
    error: "invalid",
  })
})

const { db } = await import("@/lib/db")

describe("database actions", () => {
  let dir: string
  let closeDb: () => void

  async function links() {
    const rows = await db
      .select({
        serviceId: teamMemberServices.serviceId,
        teamMemberId: teamMemberServices.teamMemberId,
      })
      .from(teamMemberServices)
      .where(eq(teamMemberServices.businessId, "biz"))
    const map: Record<string, string[]> = {}
    for (const row of rows) {
      const list = map[row.serviceId] ?? []
      list.push(row.teamMemberId)
      map[row.serviceId] = list
    }
    return map
  }

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "koblip-teamsvc-test-"))
    process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
    const { migrate } = await import("drizzle-orm/libsql/migrator")
    await migrate(db, { migrationsFolder: "drizzle" })
    closeDb = () => db.$client.close()

    await db.insert(user).values({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    })
    await db.insert(businesses).values({
      id: "biz",
      slug: "shop",
      name: "Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    })
    await db.insert(services).values([
      { id: "s1", businessId: "biz", name: "Cut", durationMinutes: 30, position: 0 },
      { id: "s2", businessId: "biz", name: "Shave", durationMinutes: 30, position: 1 },
    ])
    await db.insert(teamMembers).values([
      { id: "m1", businessId: "biz", name: "Ana", position: 0 },
      { id: "m2", businessId: "biz", name: "Ben", position: 1 },
    ])
  })

  afterAll(() => {
    closeDb()
    rmSync(dir, { recursive: true, force: true })
  })

  test("setServiceTeam stores a subset, clears on a full team", async () => {
    expect(await setServiceTeam("biz", "s1", ["m1"])).toEqual({ ok: true })
    expect(await links()).toEqual({ s1: ["m1"] })
    expect(await setServiceTeam("biz", "s1", ["m1", "m2"])).toEqual({
      ok: true,
    })
    expect(await links()).toEqual({})
    expect(await setServiceTeam("biz", "s1", ["m1", "m1"])).toEqual({
      ok: false,
      error: "invalid",
    })
    expect(await setServiceTeam("biz", "s1", ["zzz"])).toEqual({
      ok: false,
      error: "invalid",
    })
    expect(await setServiceTeam("biz", "nope", ["m1"])).toEqual({
      ok: false,
      error: "invalid",
    })
  })

  test("setMemberServices rewrites rows, never stranding a service", async () => {
    expect(await setMemberServices("biz", "m1", [])).toEqual({ ok: true })
    expect(await links()).toEqual({ s1: ["m2"], s2: ["m2"] })
    expect(await setMemberServices("biz", "m2", [])).toEqual({
      ok: false,
      error: "last_member",
    })
    expect(await links()).toEqual({ s1: ["m2"], s2: ["m2"] })
    expect(await setMemberServices("biz", "m1", ["s1", "s2"])).toEqual({
      ok: true,
    })
    expect(await links()).toEqual({})
  })
})
