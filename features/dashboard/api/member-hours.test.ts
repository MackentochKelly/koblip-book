// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businesses, teamMembers, teamMemberHours, user } from "@/lib/db/schema"
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({ userId: "owner" })),
}))
const { saveTeamMemberWithHours } = await import("./member-hours")
let dir: string
let db: (typeof import("@/lib/db"))["db"]
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "save-member-hours-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(user)
    .values({ id: "owner", name: "Owner", email: "owner@example.com" })
  await db.insert(businesses).values([
    {
      id: "biz",
      slug: "shop",
      name: "Shop",
      timezone: "UTC",
      currency: "USD",
      ownerId: "owner",
    },
    {
      id: "other",
      slug: "other",
      name: "Other",
      timezone: "UTC",
      currency: "USD",
    },
  ])
  await db.insert(teamMembers).values([
    { id: "m", businessId: "biz", name: "Ana" },
    { id: "stranger", businessId: "other", name: "Other" },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
const person = (name: string) => ({
  name,
  phone: null,
  email: null,
  description: null,
})
const rows = [
  { weekday: 1, opensAt: "22:00", closesAt: "02:00" },
  { weekday: 2, opensAt: "00:00", closesAt: "00:00" },
]
test("owner saves split/overnight hours and restores inheritance", async () => {
  expect(await saveTeamMemberWithHours("biz", "m", person("Ana"), rows)).toEqual({
    ok: true,
    id: "m",
  })
  expect(await db.select().from(teamMemberHours)).toHaveLength(2)
  expect(await saveTeamMemberWithHours("biz", "m", person("Renamed"), null)).toEqual({
    ok: true,
    id: "m",
  })
  expect(await db.select().from(teamMemberHours)).toEqual([])
  expect(
    (await db.select().from(teamMembers).where(eq(teamMembers.id, "m")))[0].name
  ).toBe("Renamed")
})
test("invalid hours cannot rename or create a member", async () => {
  for (const bad of [
    [],
    [{ weekday: 7, opensAt: "10:00", closesAt: "11:00" }],
    [{ weekday: 1, opensAt: "24:00", closesAt: "11:00" }],
    Array(15).fill(rows[0]),
  ]) {
    expect(await saveTeamMemberWithHours("biz", "m", person("Wrong"), bad)).toEqual({
      ok: false,
      error: "invalid",
    })
    expect(await saveTeamMemberWithHours("biz", null, person("Wrong"), bad)).toEqual({
      ok: false,
      error: "invalid",
    })
  }
  expect(
    (await db.select().from(teamMembers).where(eq(teamMembers.id, "m")))[0].name
  ).toBe("Renamed")
  expect(await db.select().from(teamMembers)).toHaveLength(2)
})
test("cross-business member and unowned business cannot be changed", async () => {
  expect(
    await saveTeamMemberWithHours("biz", "stranger", person("Wrong"), rows)
  ).toEqual({ ok: false, error: "not_found" })
  expect(
    await saveTeamMemberWithHours("other", "stranger", person("Wrong"), rows)
  ).toEqual({ ok: false, error: "not_found" })
  expect(await db.select().from(teamMemberHours)).toEqual([])
})
test("new member and hours save together", async () => {
  const saved = await saveTeamMemberWithHours("biz", null, person("New"), rows)
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.name, "New"))
  expect(saved).toEqual({ ok: true, id: member.id })
  expect(
    (await db.select().from(teamMemberHours)).every(
      (row) => row.teamMemberId === member.id && row.businessId === "biz"
    )
  ).toBe(true)
})

test("phone, email and description are checked and saved", async () => {
  const details = {
    name: " Ana ",
    phone: " +1 809 555 0000 ",
    email: "ana@example.com",
    description: " Colour expert ",
  }
  for (const [field, value] of [
    ["name", ""],
    ["phone", "call me"],
    ["email", "ana@"],
    ["description", "x".repeat(121)],
  ] as const) {
    expect(
      await saveTeamMemberWithHours("biz", "m", { ...details, [field]: value }, null)
    ).toEqual({ ok: false, error: field })
  }
  expect(await saveTeamMemberWithHours("biz", "m", details, null)).toEqual({
    ok: true,
    id: "m",
  })
  const [saved] = await db.select().from(teamMembers).where(eq(teamMembers.id, "m"))
  expect(saved).toMatchObject({
    name: "Ana",
    phone: "+1 809 555 0000",
    email: "ana@example.com",
    description: "Colour expert",
  })
  await saveTeamMemberWithHours("biz", "m", { ...details, phone: " ", email: "", description: "" }, null)
  const [cleared] = await db.select().from(teamMembers).where(eq(teamMembers.id, "m"))
  expect(cleared).toMatchObject({ phone: null, email: null, description: null })
})

test("removing a member also removes their custom hours without relying on database cascades", async () => {
  const { deleteTeamMember } = await import("./actions")
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.name, "New"))
  expect(await deleteTeamMember("biz", member.id)).toEqual({ ok: true })
  expect(
    await db
      .select()
      .from(teamMemberHours)
      .where(eq(teamMemberHours.teamMemberId, member.id))
  ).toEqual([])
})
