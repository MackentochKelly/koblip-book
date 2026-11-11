// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businesses, planFeatures, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const session = { userId: "u1", name: "Owner", email: "owner@example.com" }
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => session),
  getSession: vi.fn(async () => session),
}))

// Stripe, as its API answers (docs/online-payments.md).
const stripe = {
  created: [] as { identity: { country: string } }[],
  closed: [] as string[],
  cardStatus: "restricted",
  v2: {
    core: {
      accounts: {
        create: vi.fn(async (params: { identity: { country: string } }) => {
          stripe.created.push(params)
          return {
            id: `acct_${stripe.created.length}`,
            configuration: {
              merchant: {
                capabilities: { card_payments: { status: stripe.cardStatus } },
              },
            },
          }
        }),
        close: vi.fn(async (id: string) => {
          stripe.closed.push(id)
        }),
      },
      accountLinks: {
        create: vi.fn(async ({ account }: { account: string }) => ({
          url: `https://connect.stripe.test/${account}`,
        })),
      },
    },
  },
  accounts: {
    retrieve: vi.fn(async (id: string) => ({ id, charges_enabled: true })),
  },
}
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_test"
process.env.BETTER_AUTH_URL = "https://book.example.com"
vi.mock("@/lib/stripe", () => ({ stripeClient: stripe, stripeKeys: {} }))

const { connectStripeAccount, saveOnlinePay } = await import(
  "./online-pay-actions"
)
const { cardPayFor, stripeStateOf, syncStripeAccount, businessCountry } =
  await import("@/lib/stripe-connect")

let closeDb: () => void
let dir: string

const row = async (id: string) => {
  const { db } = await import("@/lib/db")
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, id))
  return business
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-online-pay-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  const us = { timezone: "America/New_York", currency: "USD", ownerId: "u1" }
  await db.insert(businesses).values([
    { id: "us", slug: "us", name: "Salon", ...us },
    { id: "us2", slug: "us2", name: "Second", ...us },
    { id: "demo", slug: "demo", name: "Demo", ...us, isDemo: true },
    {
      id: "do",
      slug: "do",
      name: "Salón",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    },
    { id: "theirs", slug: "theirs", name: "Theirs", ...us, ownerId: "other" },
  ])
  // The tests' businesses pay for nothing: online payments on every plan.
  await db
    .insert(planFeatures)
    .values({ featureKey: "onlinePayments", plan: "free", updatedBy: "u1" })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  stripe.cardStatus = "restricted"
})

test("a business's country comes from its time zone", () => {
  expect(businessCountry("America/New_York")).toBe("US")
  expect(businessCountry("America/Santo_Domingo")).toBe("DO")
  expect(businessCountry("Europe/Madrid")).toBe("ES")
  expect(businessCountry("UTC")).toBeNull()
})

test("connecting makes the business's Stripe account once", async () => {
  const first = await connectStripeAccount("us")
  expect(first).toEqual({ ok: true, url: "https://connect.stripe.test/acct_1" })
  expect(stripe.created.at(-1)).toMatchObject({
    dashboard: "full",
    identity: { country: "us" },
    defaults: {
      responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
    },
    metadata: { businessId: "us" },
  })
  expect(await row("us")).toMatchObject({
    stripeAccountId: "acct_1",
    stripeChargesOn: false,
  })
  expect(stripeStateOf(await row("us"))).toBe("details")
  // Again: the same account, a new link.
  const made = stripe.created.length
  expect(await connectStripeAccount("us")).toMatchObject({ ok: true })
  expect(stripe.created.length).toBe(made)
})

test("where Stripe takes no cards, nothing is connected and the owner is told", async () => {
  stripe.cardStatus = "unsupported"
  expect(await connectStripeAccount("do")).toEqual({
    ok: false,
    error: "country",
  })
  const business = await row("do")
  expect(business.stripeAccountId).toBeNull()
  expect(business.stripeRefusedCountry).toBe("DO")
  expect(stripe.closed).toHaveLength(1)
  expect(stripeStateOf(business)).toBe("country")
})

test("only the owner, never a demo, connects", async () => {
  expect(await connectStripeAccount("theirs")).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await connectStripeAccount("demo")).toEqual({
    ok: false,
    error: "not_found",
  })
})

test("the card setting needs the Stripe account, and Stripe's yes to be offered", async () => {
  expect(await saveOnlinePay("us2", { mode: "full" })).toEqual({
    ok: false,
    error: "not_connected",
  })
  expect(
    await saveOnlinePay("us", { mode: "deposit", type: "amount", value: 10 })
  ).toEqual({ ok: false, error: "amount" })
  expect(
    await saveOnlinePay("us", { mode: "deposit", type: "percent", value: 20 })
  ).toEqual({ ok: true })
  expect(await row("us")).toMatchObject({
    onlinePay: "deposit",
    depositType: "percent",
    depositValue: 20,
  })
  // Stripe has not said yes yet: customers see no card.
  expect(await cardPayFor(await row("us"))).toBeNull()
  expect(await syncStripeAccount("us", "acct_1")).toEqual({ chargesOn: true })
  expect(stripeStateOf(await row("us"))).toBe("ready")
  expect(await cardPayFor(await row("us"))).toEqual({
    mode: "deposit",
    type: "percent",
    value: 20,
  })
  // Full price keeps the last deposit for the next time; off turns it off.
  expect(await saveOnlinePay("us", { mode: "full" })).toEqual({ ok: true })
  expect(await cardPayFor(await row("us"))).toEqual({ mode: "full" })
  expect(await saveOnlinePay("us", { mode: "off" })).toEqual({ ok: true })
  expect(await row("us")).toMatchObject({ onlinePay: "off", depositValue: 20 })
  expect(await cardPayFor(await row("us"))).toBeNull()
})

test("a plan without online payments has no card", async () => {
  const { db } = await import("@/lib/db")
  await saveOnlinePay("us", { mode: "full" })
  await db
    .update(planFeatures)
    .set({ plan: "pro" })
    .where(eq(planFeatures.featureKey, "onlinePayments"))
  expect(await saveOnlinePay("us", { mode: "off" })).toEqual({
    ok: false,
    error: "not_found",
  })
})
