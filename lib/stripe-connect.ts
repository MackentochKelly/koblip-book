import "server-only"
import { getCountriesForTimezone } from "countries-and-timezones"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"

import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import {
  ONLINE_PAY_RULES,
  onlinePayOf,
  stripeAmount,
  type OnlinePay,
} from "@/lib/payment-rules"
import { hasFeature } from "@/lib/plan-access"
import { runInTurn } from "@/lib/run-in-turn"
import { stripeClient } from "@/lib/stripe"

// Online payments (docs/plans/online-payments.md, docs/online-payments.md):
// each business has its own Stripe account, connected to Koblip's (Stripe
// Connect, direct charges). The customer pays the business on Stripe's
// page; Koblip never holds the money. Off until Koblip's Stripe key and the
// second webhook's secret are both set.
const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
export const stripeConnect =
  stripeClient && webhookSecret ? { client: stripeClient, webhookSecret } : null

type BusinessRow = typeof businesses.$inferSelect

// The country a business is in, from its time zone: Stripe needs it before
// it makes the account, and the app asks the owner for no country. Null
// for a zone no country has (UTC).
export function businessCountry(timezone: string): string | null {
  return getCountriesForTimezone(timezone)[0]?.id ?? null
}

// Where a business stands with Stripe, from what is saved:
// none: not connected. country: Stripe does not take card payments where
// it is (ON15). details: connected, Stripe still needs details before it
// can take payments. ready: it can.
export type StripeState = "none" | "country" | "details" | "ready"

export function stripeStateOf(
  business: Pick<
    BusinessRow,
    "stripeAccountId" | "stripeChargesOn" | "stripeRefusedCountry" | "timezone"
  >
): StripeState {
  if (business.stripeAccountId)
    return business.stripeChargesOn ? "ready" : "details"
  const country = businessCountry(business.timezone)
  return !country || country === business.stripeRefusedCountry
    ? "country"
    : "none"
}

// What a customer pays by card when booking with this business, or null:
// card payments are on in the app, the business is real, its plan has
// them, Stripe says its account can take payments, and the owner chose a
// deposit or the full price.
export async function cardPayFor(
  business: Pick<
    BusinessRow,
    | "id"
    | "isDemo"
    | "stripeAccountId"
    | "stripeChargesOn"
    | "onlinePay"
    | "depositType"
    | "depositValue"
  >
): Promise<OnlinePay | null> {
  if (!stripeConnect || business.isDemo) return null
  if (!business.stripeAccountId || !business.stripeChargesOn) return null
  const pay = onlinePayOf(business)
  if (!pay) return null
  return (await hasFeature(business.id, "onlinePayments")) ? pay : null
}

// Makes the business's Stripe account if it has none, then the link to
// Stripe's own pages where the owner gives Stripe what it asks (ON3). The
// caller has already checked who is asking and the plan.
export async function connectStripe(
  business: Pick<
    BusinessRow,
    "id" | "name" | "timezone" | "stripeAccountId"
  >,
  ownerEmail: string,
  urls: { back: string; again: string }
): Promise<
  { ok: true; url: string } | { ok: false; error: "off" | "country" | "failed" }
> {
  if (!stripeConnect) return { ok: false, error: "off" }
  const { client } = stripeConnect
  // One at a time per business: two taps never make two accounts.
  return runInTurn(`stripe-connect:${business.id}`, async () => {
    try {
      const [saved] = await db
        .select({ stripeAccountId: businesses.stripeAccountId })
        .from(businesses)
        .where(eq(businesses.id, business.id))
        .limit(1)
      let accountId = saved?.stripeAccountId ?? null
      if (!accountId) {
        const country = businessCountry(business.timezone)
        if (!country) return { ok: false, error: "country" } as const
        // Accounts v2 (docs.stripe.com/connect/saas/quickstart): the
        // business gets Stripe's full dashboard, pays Stripe's fees itself,
        // and Stripe covers losses (ON2).
        const account = await client.v2.core.accounts.create({
          display_name: business.name,
          contact_email: ownerEmail,
          dashboard: "full",
          defaults: {
            responsibilities: {
              fees_collector: "stripe",
              losses_collector: "stripe",
            },
          },
          identity: { country: country.toLowerCase() },
          configuration: {
            merchant: {
              capabilities: { card_payments: { requested: true } },
            },
          },
          metadata: { businessId: business.id },
          include: ["configuration.merchant"],
        })
        const card =
          account.configuration?.merchant?.capabilities?.card_payments
        if (card?.status === "unsupported") {
          // Stripe takes no card payments there: nothing stays behind.
          await client.v2.core.accounts
            .close(account.id, { applied_configurations: ["merchant"] })
            .catch(() => {})
          await db
            .update(businesses)
            .set({ stripeRefusedCountry: country })
            .where(eq(businesses.id, business.id))
          return { ok: false, error: "country" } as const
        }
        accountId = account.id
        await db
          .update(businesses)
          .set({
            stripeAccountId: accountId,
            stripeChargesOn: false,
            stripeRefusedCountry: null,
          })
          .where(eq(businesses.id, business.id))
      }
      const link = await client.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            refresh_url: urls.again,
            return_url: urls.back,
          },
        },
      })
      return { ok: true, url: link.url } as const
    } catch (error) {
      console.error("Couldn't connect Stripe", error)
      return { ok: false, error: "failed" } as const
    }
  })
}

// Asks Stripe whether the business's account can take payments and saves
// the answer. Only this and the webhook set stripeChargesOn. Null when
// Stripe could not be asked; what is saved then stays.
export async function syncStripeAccount(
  businessId: string,
  accountId: string
): Promise<{ chargesOn: boolean } | null> {
  if (!stripeConnect) return null
  try {
    const account = await stripeConnect.client.accounts.retrieve(accountId)
    return await saveStripeAccount(businessId, account)
  } catch (error) {
    console.error("Couldn't read the Stripe account", error)
    return null
  }
}

// Saves what Stripe says about an account (from the call above or from its
// `account.updated` event).
export async function saveStripeAccount(
  businessId: string,
  account: Pick<Stripe.Account, "id" | "charges_enabled">
): Promise<{ chargesOn: boolean }> {
  const chargesOn = account.charges_enabled === true
  await db
    .update(businesses)
    .set({ stripeChargesOn: chargesOn })
    .where(eq(businesses.id, businessId))
  return { chargesOn }
}

// Stripe's payment page for one held booking, made on the business's own
// account (a direct charge). It closes by itself after holdMinutes.
export async function createCardSession(input: {
  accountId: string
  businessId: string
  holdId: string
  bookingId: string
  // What the customer sees on Stripe's page.
  title: string
  description: string | null
  amountMinor: number
  currency: string
  email: string | null
  successUrl: string
  cancelUrl: string
}): Promise<{ id: string; url: string } | null> {
  if (!stripeConnect) return null
  const amount = stripeAmount(input.amountMinor, input.currency)
  const fee = Math.round((amount * ONLINE_PAY_RULES.feePercent) / 100)
  const metadata = {
    businessId: input.businessId,
    holdId: input.holdId,
    bookingId: input.bookingId,
  }
  const session = await stripeConnect.client.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: amount,
            product_data: {
              name: input.title,
              ...(input.description ? { description: input.description } : {}),
            },
          },
        },
      ],
      ...(input.email ? { customer_email: input.email } : {}),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      // A minute over Stripe's shortest, so a slow call is never under it.
      expires_at:
        Math.floor(Date.now() / 1000) + ONLINE_PAY_RULES.holdMinutes * 60 + 60,
      metadata,
      payment_intent_data: {
        metadata,
        ...(fee > 0 ? { application_fee_amount: fee } : {}),
      },
    },
    // The hold is paid for once, however often this is asked.
    { stripeAccount: input.accountId, idempotencyKey: `hold-${input.holdId}` }
  )
  return session.url ? { id: session.id, url: session.url } : null
}

// What Stripe says about a payment page, asked on the business's account.
// Never trust a session id for more than this answer.
export async function readCardSession(
  accountId: string,
  sessionId: string
): Promise<Stripe.Checkout.Session | null> {
  if (!stripeConnect) return null
  try {
    return await stripeConnect.client.checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: accountId }
    )
  } catch (error) {
    console.error("Couldn't read the Stripe payment page", error)
    return null
  }
}

// Closes a payment page nobody will pay on, so it cannot be paid later.
export async function closeCardSession(
  accountId: string,
  sessionId: string
): Promise<void> {
  if (!stripeConnect) return
  await stripeConnect.client.checkout.sessions
    .expire(sessionId, {}, { stripeAccount: accountId })
    .catch(() => {})
}

// Gives a payment back in full, on the business's account (ON10). `key`
// makes asking twice one refund. Koblip's fee, if one was taken, goes back
// too.
export async function refundCardPayment(
  accountId: string,
  paymentId: string,
  key: string
): Promise<{ id: string; amount: number; currency: string } | null> {
  if (!stripeConnect) return null
  const refund = await stripeConnect.client.refunds.create(
    {
      payment_intent: paymentId,
      ...(ONLINE_PAY_RULES.feePercent > 0
        ? { refund_application_fee: true }
        : {}),
    },
    { stripeAccount: accountId, idempotencyKey: key }
  )
  return { id: refund.id, amount: refund.amount, currency: refund.currency }
}
