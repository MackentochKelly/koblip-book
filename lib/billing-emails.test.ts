// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type Stripe from "stripe"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn(async () => true) }))
vi.mock("@/lib/email", () => ({ sendEmail }))

// The emails' words come from the app's words, English here.
const { registerEnglishWords } = await import("./translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)

const { billingEmailHooks, paymentJustFailed, sendBillingEmail } = await import("./billing-emails")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-billing-emails-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.BETTER_AUTH_URL = "https://book.example.com"
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    { id: "ana", name: "Ana", email: "ana@example.com", emailVerified: true },
    { id: "phone", name: "Phone", email: "18095550123@phone.invalid", emailVerified: false },
  ])
  await db.insert(businesses).values([
    { id: "salon", slug: "salon", name: "Ana's Salon", timezone: "UTC", currency: "USD", ownerId: "ana" },
    { id: "barber", slug: "barber", name: "Barber", timezone: "UTC", currency: "USD", ownerId: "phone" },
  ])
})

beforeEach(() => sendEmail.mockClear())

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const update = (status: string, before?: string) => ({
  event: { data: { object: {}, previous_attributes: before ? { status: before } : {} } } as Stripe.Event,
  stripeSubscription: { status } as Stripe.Subscription,
})

test("only the move into past_due is a failed payment, not each retry", () => {
  expect(paymentJustFailed(update("past_due", "active").event, update("past_due").stripeSubscription)).toBe(true)
  const retry = update("past_due")
  expect(paymentJustFailed(retry.event, retry.stripeSubscription)).toBe(false)
  const paid = update("active", "past_due")
  expect(paymentJustFailed(paid.event, paid.stripeSubscription)).toBe(false)
})

test("the owner hears of a failed payment, with a link to the business's plan", async () => {
  await billingEmailHooks.onSubscriptionUpdate({
    ...update("past_due", "active"),
    subscription: { referenceId: "salon" },
  })
  expect(sendEmail).toHaveBeenCalledTimes(1)
  const [email] = sendEmail.mock.calls[0] as unknown as [{ to: string; subject: string; text: string }]
  expect(email.to).toBe("ana@example.com")
  expect(email.subject).toBe("Pro payment for Ana's Salon didn't go through")
  expect(email.text).toContain("https://book.example.com/dashboard/salon/settings/plan")
})

test("back on Free: the owner hears it once the plan has ended", async () => {
  await billingEmailHooks.onSubscriptionDeleted({ subscription: { referenceId: "salon" } })
  const [email] = sendEmail.mock.calls[0] as unknown as [{ subject: string }]
  expect(email.subject).toBe("Ana's Salon is back on Free")
})

test("an owner who signed up by phone has no email to reach", async () => {
  expect(await sendBillingEmail("backToFree", "barber")).toBe(false)
  expect(sendEmail).not.toHaveBeenCalled()
})
