// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, businessPolicies, user } from "@/lib/db/schema"
import { POLICY_RULES } from "@/lib/policy-rules"

vi.mock("server-only", () => ({}))
// Saves send their changed texts to Google after the answer (tested in
// lib/translations); here only that they ask to.
const { translateBusinessSoon } = vi.hoisted(() => ({
  translateBusinessSoon: vi.fn(),
}))
vi.mock("@/lib/translations/business-texts", () => ({ translateBusinessSoon }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { removePolicy, saveOwnPolicy, savePolicy } =
  await import("./policy-actions")
const { getPolicies } = await import("./policy-queries")

let closeDb: () => void
let dir: string
let db: Awaited<typeof import("@/lib/db")>["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-policies-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  db = (await import("@/lib/db")).db
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    {
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    },
    {
      id: "other",
      name: "Other",
      email: "other@example.com",
      emailVerified: false,
    },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-mine",
      slug: "my-shop",
      name: "My Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    },
    {
      id: "biz-theirs",
      slug: "their-shop",
      name: "Their Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "other",
    },
  ])
  await db.insert(businessPolicies).values({
    id: "pol-theirs",
    businessId: "biz-theirs",
    kind: null,
    title: "Theirs",
    body: "Their text.",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("adds standard and own policies, the standard ones first", async () => {
  translateBusinessSoon.mockClear()
  expect(
    await saveOwnPolicy("biz-mine", null, {
      title: "  Late arrivals ",
      body: " Ten minutes late: we may shorten it. ",
    })
  ).toEqual({ ok: true })
  expect(
    await savePolicy("biz-mine", "privacy", "We keep your phone.")
  ).toEqual({
    ok: true,
  })
  expect(
    await savePolicy("biz-mine", "booking", "Cancel a day ahead.")
  ).toEqual({
    ok: true,
  })
  const { policies } = await getPolicies("biz-mine")
  expect(policies).toMatchObject([
    { kind: "booking", title: null, body: "Cancel a day ahead." },
    { kind: "privacy", title: null, body: "We keep your phone." },
    {
      kind: null,
      title: "Late arrivals",
      body: "Ten minutes late: we may shorten it.",
    },
  ])
  // Each save sends its texts to Google.
  expect(translateBusinessSoon).toHaveBeenCalledTimes(3)
  expect(translateBusinessSoon).toHaveBeenCalledWith("biz-mine")
})

test("a standard kind keeps one row; the owner's own can be many", async () => {
  expect(
    await savePolicy("biz-mine", "booking", "Cancel two days ahead.")
  ).toEqual({ ok: true })
  expect(
    await saveOwnPolicy("biz-mine", null, { title: "Deposits", body: "Half." })
  ).toEqual({ ok: true })
  const { policies } = await getPolicies("biz-mine")
  expect(policies.filter((policy) => policy.kind === "booking")).toMatchObject([
    { body: "Cancel two days ahead." },
  ])
  expect(
    policies.filter((policy) => policy.kind === null).map((p) => p.title)
  ).toEqual(["Late arrivals", "Deposits"])
})

test("changes and removes only the business's own rows", async () => {
  const { policies } = await getPolicies("biz-mine")
  const own = policies.find((policy) => policy.title === "Deposits")!
  const booking = policies.find((policy) => policy.kind === "booking")!
  expect(
    await saveOwnPolicy("biz-mine", own.id, {
      title: "Deposit",
      body: "A third.",
    })
  ).toEqual({ ok: true })
  // A standard one is changed by its kind, never as the owner's own.
  expect(
    await saveOwnPolicy("biz-mine", booking.id, { title: "X", body: "Y" })
  ).toEqual({ ok: false, error: "not_found" })
  // Another business's policy is out of reach.
  expect(
    await saveOwnPolicy("biz-mine", "pol-theirs", { title: "X", body: "Y" })
  ).toEqual({ ok: false, error: "not_found" })
  expect(await removePolicy("biz-mine", "pol-theirs")).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await removePolicy("biz-theirs", "pol-theirs")).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await removePolicy("biz-mine", booking.id)).toEqual({ ok: true })
  const after = await getPolicies("biz-mine")
  expect(after.policies.map((policy) => policy.kind ?? policy.title)).toEqual([
    "privacy",
    "Late arrivals",
    "Deposit",
  ])
})

test("refuses empty or too long text and titles", async () => {
  expect(await savePolicy("biz-mine", "terms", "  ")).toEqual({
    ok: false,
    error: "invalid",
  })
  expect(await savePolicy("biz-mine", "nope", "Text")).toEqual({
    ok: false,
    error: "invalid",
  })
  expect(
    await saveOwnPolicy("biz-mine", null, { title: " ", body: "Text" })
  ).toEqual({ ok: false, error: "invalid" })
  expect(
    await saveOwnPolicy("biz-mine", null, {
      title: "x".repeat(POLICY_RULES.maxTitle + 1),
      body: "Text",
    })
  ).toEqual({ ok: false, error: "invalid" })
  expect(
    await saveOwnPolicy("biz-mine", null, {
      title: "Long",
      body: "x".repeat(POLICY_RULES.maxLength + 1),
    })
  ).toEqual({ ok: false, error: "invalid" })
})

test("stops adding at the limit, but still changes what is there", async () => {
  const { policies } = await getPolicies("biz-mine")
  for (let n = policies.length; n < POLICY_RULES.maxPolicies; n++) {
    await saveOwnPolicy("biz-mine", null, { title: `Own ${n}`, body: "x" })
  }
  expect(
    await saveOwnPolicy("biz-mine", null, { title: "One more", body: "x" })
  ).toEqual({ ok: false, error: "limit" })
  expect(await savePolicy("biz-mine", "terms", "Terms.")).toEqual({
    ok: false,
    error: "limit",
  })
  expect(await savePolicy("biz-mine", "privacy", "Changed.")).toEqual({
    ok: true,
  })
})
