# Online payments (Stripe Connect)

Customers pay a business by card when they book. The money goes to the business's own Stripe account; Koblip never holds it. Decisions and tasks: [plans/online-payments.md](plans/online-payments.md). Subscriptions are a different thing with their own webhook: [billing.md](billing.md).

Online payments are off until `STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` are both set.

## What Stripe holds

| Thing | Value |
| --- | --- |
| Koblip's account | United States. Connect is on in the sandbox ("KOBLIP"), checked Nov 10 by making a test business account, its onboarding link and a payment page through the API |
| Each business | Its own Stripe account, made by the app with the Accounts v2 API: full Stripe dashboard, Stripe's fees paid by the business, losses covered by Stripe, `card_payments` asked for. `metadata.businessId` is the Koblip business |
| Payments | Stripe Checkout sessions made **on the business's account** (direct charges). `metadata.holdId` and `metadata.businessId` say which booking it pays |
| Koblip's fee | None: `ONLINE_PAY_RULES.feePercent` in [lib/payment-rules.ts](../lib/payment-rules.ts) is 0 |
| Webhook | `<BETTER_AUTH_URL>/api/stripe/connect`, listening to **Connected accounts**, events below. Not the subscriptions one |

Webhook events ([docs.stripe.com/connect/webhooks](https://docs.stripe.com/connect/webhooks)):

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- `account.updated`

## Countries

Checked in the sandbox on Nov 10: Koblip's US account can make business accounts in other countries (Spain, Mexico, Brazil, Canada, United Kingdom all answered "more details needed", the normal start). For the Dominican Republic Stripe answers `unsupported_country` for card payments, so those businesses are told "Not in your country yet" and nothing is connected.

The app takes a business's country from its time zone, since Stripe needs the country before it makes the account. Stripe's list: [stripe.com/global](https://stripe.com/global).

## Keys

| Key | Where it comes from | Where it goes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | The same key subscriptions use | `.env.local` on the Mac, `.env.production` on the server |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Locally: `stripe listen --print-secret` (the same value as `STRIPE_WEBHOOK_SECRET`, the CLI has one secret). Live: the signing secret of the Connected accounts endpoint, which is **not** the subscriptions endpoint's | Same |

Never commit a key or paste one into chat.

## Testing on the Mac

The Stripe CLI forwards the businesses' events to the dev server:

```bash
stripe listen --api-key "$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2)" --all-snapshot --forward-connect-to localhost:3100/api/stripe/connect
```

`--all-snapshot` is needed since CLI 1.55: without it the CLI asks which events to forward.

Without the CLI running, a payment still ends as a booking: the page the customer comes back to asks Stripe itself. Only closed tabs, refunds made in Stripe and disputes need the webhook.

- Connect a test business: Settings → Payments → Connect Stripe, then on Stripe's pages use the test values Stripe offers ([docs.stripe.com/connect/testing](https://docs.stripe.com/connect/testing)): phone `000 000 0000`, code `000-000`, SSN `000-00-0000`, address `address_full_match`, bank routing `110000000`, account `000123456789`.
- Test cards ([docs.stripe.com/testing](https://docs.stripe.com/testing)): `4242 4242 4242 4242` pays; `4000 0000 0000 0002` is declined; `4000 0025 0000 3155` asks for the bank check; `4000 0000 0000 0259` pays, then is disputed.

## Going live

1. **Connect in live mode.** Dashboard → Connect: finish Stripe's platform profile for the live account (Stripe asks how Koblip uses Connect: businesses are the sellers, direct charges).
2. **Webhook.** Dashboard → Developers → Webhooks → add `https://book.koblip.com/api/stripe/connect`, **Events from: Connected accounts**, with the 7 events above. Copy its signing secret.
3. **Key on the server.** Put `STRIPE_CONNECT_WEBHOOK_SECRET` in `.env.production`, then deploy ([deploy.md](deploy.md)).
4. **One real payment.** Connect a real business, pay a small deposit with a real card, refund it.
