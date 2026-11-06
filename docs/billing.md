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
| Stripe Tax | Head office address set, status active |
| Webhook | `<BETTER_AUTH_URL>/api/auth/stripe/webhook`, events below |

Webhook events (better-auth.com/docs/plugins/stripe#set-up-stripe-webhooks):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The sandbox ("KOBLIP") has all of this except a webhook endpoint, since locally the Stripe CLI forwards events instead (below).

## Keys

| Key | Where it comes from | Where it goes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Dashboard → Developers → API keys (`sk_test_…` in the sandbox, `sk_live_…` live) | `.env.local` on the Mac, `.env.production` on the server |
| `STRIPE_WEBHOOK_SECRET` | Locally: `stripe listen --print-secret`. Live: the webhook endpoint's signing secret | Same |

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

1. **Tax registrations.** Stripe Tax only collects tax where the account is registered, and none is added yet. Add them in Dashboard → Tax → Registrations, with your accountant's advice. Checkout already asks Stripe Tax for it.
2. **Live product and prices.** Make the product, both prices and the portal as in the table above, in live mode.
3. **Webhook.** Dashboard → Developers → Webhooks → add `https://book.koblip.com/api/auth/stripe/webhook` with the 4 events. Copy its signing secret.
4. **Keys on the server.** Put `STRIPE_SECRET_KEY` (`sk_live_…`) and `STRIPE_WEBHOOK_SECRET` in `.env.production`, then deploy ([deploy.md](deploy.md)).
5. **Turn on plan limits.** Set `billingLive` to `true` in [lib/subscription-rules.ts](../lib/subscription-rules.ts) and deploy. Until then every business has every feature, and Settings → Plan only takes payments.
