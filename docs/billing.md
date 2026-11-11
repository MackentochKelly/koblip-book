# Billing (Stripe)

Owners pay for Pro through Stripe. The app uses Better Auth's Stripe plugin ([lib/auth.ts](../lib/auth.ts)); Stripe hosts Checkout and the Customer Portal, so the app never sees a card. Decisions and tasks: [plans/subscriptions.md](plans/subscriptions.md).

Billing is off until both keys are set. Without them the plugin isn't loaded ([lib/stripe.ts](../lib/stripe.ts)).

## What Stripe holds

Make the same things in the sandbox and in live mode. The app finds prices by lookup key, so the ids may differ.

| Thing | Value |
| --- | --- |
| Product | `koblip_pro`, "Koblip Pro", tax code `txcd_10103001` (software as a service, business use) |
| Monthly price | $19 USD a month, lookup key `koblip_pro_monthly`, tax exclusive |
| Yearly price | $190 USD a year, lookup key `koblip_pro_yearly`, tax exclusive |
| Customer Portal (default configuration) | Change card, see invoices, update email, name, address and tax id. Switch monthly ↔ yearly (yearly → monthly waits for the period end). Cancel at period end, with a reason. Terms `https://book.koblip.com/terms`, privacy `https://book.koblip.com/privacy` |
| Free Pro coupon | `koblip_pro_free`, "Pro, given by Koblip": 100% off, forever, applies to `koblip_pro` only. Admin → Subscriptions → Give Pro free uses it (no card needed) |
| Stripe Tax | Head office address set, status active |
| Webhook | `<BETTER_AUTH_URL>/api/auth/stripe/webhook`, events below |

Webhook events (better-auth.com/docs/plugins/stripe#set-up-stripe-webhooks):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The sandbox ("KOBLIP") has all of this except a webhook endpoint, since locally the Stripe CLI forwards events instead (below).

Live mode (made Nov 11): product `prod_Vbi2JBhRM6qzrG` "Koblip Pro" with both prices and lookup keys, the free Pro coupon, the portal (both prices, switching down waits for the period end, phone off, tax id on), renewal emails, and the webhook "Koblip Book subscriptions" (`we_1UaUjfINXbkEC5NAf1Aq9BiX`, API version `2026-10-28.endive`). Not yet: Stripe Tax (not activated in live, so the product has no tax code and `STRIPE_TAX` stays unset) and the terms and privacy links, which live in the account's Public business information that Koblip Food shares.

## Keys

| Key | Where it comes from | Where it goes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Dashboard → Developers → API keys (`sk_test_…` in the sandbox, `sk_live_…` live) | `.env.local` on the Mac, `.env.production` on the server |
| `STRIPE_WEBHOOK_SECRET` | Locally: `stripe listen --print-secret`. Live: the webhook endpoint's signing secret | Same |
| `STRIPE_TAX` | `on` once Stripe Tax is set up in that account. Unset, Checkout adds no tax ([lib/stripe.ts](../lib/stripe.ts)) | Same |

The publishable key (`pk_…`) is not used: the app only sends owners to Stripe's own pages. Never commit a key or paste one into chat.

## Testing on the Mac

The Stripe CLI (`brew install stripe/stripe-cli/stripe`) forwards sandbox events to the dev server:

```bash
stripe listen --api-key "$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2)" --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3100/api/auth/stripe/webhook
```

Its signing secret stays the same between runs, so `.env.local` needs it once.

- Test cards: `4242 4242 4242 4242` pays; `4000 0000 0000 0341` attaches, then fails on renewal (docs.stripe.com/testing).
- Renewals, failed retries and the end of a period: test clocks (docs.stripe.com/billing/testing/test-clocks).

## Going live

Do this before turning on billing for real owners (P10 passes first):

1. **Tax (optional, later).** Pro can go live without it: with `STRIPE_TAX` unset, Checkout adds no tax (owner's call, Nov 11). To add tax: Dashboard → Tax → Get started (head office address), add registrations with your accountant's advice, set the product's tax code `txcd_10103001`, then `STRIPE_TAX=on` and restart.
2. **Live product and prices.** Make the product, both prices, the free Pro coupon and the portal as in the table above, in live mode.
3. **Renewal reminders.** [Subscriptions and emails settings](https://dashboard.stripe.com/settings/billing/automatic) → Email notifications and customer management → turn on **Send emails about upcoming renewals**; the days before are set under Prevent failed payments → Upcoming renewal events ([docs](https://docs.stripe.com/billing/revenue-recovery/customer-emails#renewal-reminders)). The Terms promise yearly plans a reminder before they renew (P9).
4. **Webhook.** Dashboard → Developers → Webhooks → add `https://book.koblip.com/api/auth/stripe/webhook` with the 4 events. Copy its signing secret.
5. **Keys on the server.** Put `STRIPE_SECRET_KEY` (`sk_live_…`) and `STRIPE_WEBHOOK_SECRET` in `.env.production`, then deploy ([deploy.md](deploy.md)).
