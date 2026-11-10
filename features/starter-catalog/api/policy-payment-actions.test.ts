// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  businesses,
  businessPolicies,
  businessPolicyPoints,
  paymentMethods,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAccount: vi.fn(async () => ({ userId: "u1", name: "Owner", email: "owner@example.com" })),
}))
vi.mock("@/lib/revalidate-business", () => ({ revalidateBusiness: vi.fn() }))

const { createMock, translateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  translateMock: vi.fn(),
}))

vi.mock("openai", () => ({
  default: vi.fn(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  }),
}))
vi.mock("@/lib/translations/business-texts", () => ({
  translateBusinessSoon: translateMock,
}))

let closeDb: () => void
let dir: string
let counter = 0

const reply = (payload: unknown) => ({ choices: [{ message: { content: JSON.stringify(payload) } }] })

// A business with a booking policy, an own policy and a key point, all
// saying "pay at the salon", and one way to pay.
async function seedBusiness(options: { ownerId?: string; isDemo?: boolean } = {}) {
  const { db } = await import("@/lib/db")
  counter += 1
  const id = `biz-pay-${counter}`
  await db.insert(businesses).values({
    id,
    slug: `pay-shop-${counter}`,
    name: `Pay Shop ${counter}`,
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: options.ownerId ?? "u1",
    isDemo: options.isDemo ?? false,
  })
  await db.insert(businessPolicies).values([
    { id: `${id}-booking`, businessId: id, kind: "booking", body: "Book online. You pay at the salon." },
    { id: `${id}-own`, businessId: id, kind: null, title: "Pets", body: "Pets are welcome." },
  ])
  await db.insert(businessPolicyPoints).values({
    id: `${id}-point`,
    businessId: id,
    icon: "card",
    title: "Pay at salon",
    body: "You pay at the salon.",
    position: 0,
  })
  await db.insert(paymentMethods).values({
    businessId: id,
    type: "zelle",
    name: "Zelle",
    details: "pay@shop.example",
    position: 0,
  })
  return id
}

async function stateOf(id: string) {
  const { db } = await import("@/lib/db")
  const [business] = await db.select().from(businesses).where(eq(businesses.id, id))
  const policies = await db.select().from(businessPolicies).where(eq(businessPolicies.businessId, id))
  const points = await db.select().from(businessPolicyPoints).where(eq(businessPolicyPoints.businessId, id))
  return {
    policiesPayment: business?.policiesPayment,
    bodies: Object.fromEntries(policies.map((policy) => [policy.id, policy.body])),
    point: points[0],
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-policy-pay-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.stubEnv("MODEL_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
  createMock.mockReset()
  translateMock.mockReset()
})

test("only the texts about paying change, and the policies stand for today's ways", async () => {
  const { updatePoliciesForPayments } = await import("./policy-payment-actions")
  const id = await seedBusiness()
  createMock.mockResolvedValue(
    reply({
      policies: [{ id: `${id}-booking`, body: "Book online. You pay us directly or at your visit." }],
      points: [{ id: `${id}-point`, title: "Paying", body: "You pay us directly or at your visit." }],
    })
  )
  expect(await updatePoliciesForPayments(id)).toEqual({ ok: true, changed: 2 })
  // Muse heard what the business offers now, and every text it has.
  const [request] = createMock.mock.calls[0]
  expect(request.messages[0].content).toMatch(/or at their visit/)
  expect(request.messages[1].content).toContain("Pets are welcome.")
  const after = await stateOf(id)
  expect(after.policiesPayment).toBe("direct_or_visit")
  expect(after.bodies).toEqual({
    [`${id}-booking`]: "Book online. You pay us directly or at your visit.",
    [`${id}-own`]: "Pets are welcome.",
  })
  expect(after.point).toMatchObject({ title: "Paying", icon: "card" })
  expect(translateMock).toHaveBeenCalledWith(id)
})

test("a failed rewrite changes nothing", async () => {
  const { updatePoliciesForPayments } = await import("./policy-payment-actions")
  const id = await seedBusiness()
  // Another business's text, both tries.
  createMock.mockResolvedValue(reply({ policies: [{ id: "someone-else", body: "Hi." }], points: [] }))
  expect(await updatePoliciesForPayments(id)).toEqual({ ok: false })
  expect(createMock).toHaveBeenCalledTimes(2)
  const after = await stateOf(id)
  expect(after.policiesPayment).toBeNull()
  expect(after.bodies[`${id}-booking`]).toBe("Book online. You pay at the salon.")
  expect(translateMock).not.toHaveBeenCalled()
})

test("nothing to change still settles the question", async () => {
  const { updatePoliciesForPayments } = await import("./policy-payment-actions")
  const id = await seedBusiness()
  createMock.mockResolvedValue(reply({ policies: [], points: [] }))
  expect(await updatePoliciesForPayments(id)).toEqual({ ok: true, changed: 0 })
  expect((await stateOf(id)).policiesPayment).toBe("direct_or_visit")
  expect(translateMock).not.toHaveBeenCalled()
})

test("never for another owner's business or a demo", async () => {
  const { updatePoliciesForPayments } = await import("./policy-payment-actions")
  const theirs = await seedBusiness({ ownerId: "other" })
  const demo = await seedBusiness({ isDemo: true })
  expect(await updatePoliciesForPayments(theirs)).toEqual({ ok: false })
  expect(await updatePoliciesForPayments(demo)).toEqual({ ok: false })
  expect(createMock).not.toHaveBeenCalled()
})
