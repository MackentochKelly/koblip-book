# Online payments

Customers pay the business by card when they book: the full price or a deposit. Asked by the owner (2026-11-10). Nothing is built until the owner says go.
How to use this file: [Plans](README.md).

**Status (Nov 11):** The owner said go (Nov 10): the plan as written, no Koblip fee, Pro only. Being built, task by task.

## The short version

- The money goes from the customer straight to the **business's own Stripe account**. Koblip never holds it.
- The business connects Stripe once, in Settings → Payments, then picks: off, a deposit, or the full price.
- The customer pays on Stripe's own payment page (card, Apple Pay, Google Pay) and comes back to their booking.
- The time is held while they pay. No payment, no booking.
- **Stripe does not work in the Dominican Republic.** Businesses there keep paying outside the app (bank transfer, Zelle, cash), which already works. See "Countries".

## Rules that stay

- A booking is **paid online** only when Stripe says so. No screen, tool or person can set it.
- Koblip never sees or stores a card number. Stripe's page takes it.
- Paying outside the app keeps working as it does today, beside paying online.
- A business with no Stripe account sees no change for its customers.
- Same data and code in Luma and Nova. shadcn parts and theme tokens only. Phone first.
- Nothing stored is hidden from the app admin.
- Stripe keys only in `.env.local`, only in server code.

## What exists today

| Part                        | Today                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Koblip's Stripe account     | Used for subscriptions only (`lib/stripe.ts`, the Better Auth Stripe plugin in `lib/auth.ts`, webhook `/api/auth/stripe/webhook`). `stripe` 23, API version pinned.                                                                                                                                              |
| Plans                       | `onlinePayments` is listed as "Soon" on Pro (`lib/plan-features.ts`). Home pricing shows it as coming.                                                                                                                                                                                                           |
| Paying outside the app      | Built ([outside payments](outside-payments.md), [payment proof](payment-proof.md)): the business lists ways (`payment_methods`), the customer picks one in the booking's pay step, says "I've paid", the owner marks it paid. `bookings.paymentChoice / paymentMethod / paymentStatus` (unpaid, reported, paid). |
| Booking                     | `features/booking/api/create-booking.ts` saves a booking at once as `confirmed`, inside the business's booking turn. Statuses: confirmed, cancelled, completed, no_show. There is no "waiting for payment" state.                                                                                                |
| Price                       | `bookings.priceMinor` is what is to pay, after a reward ([rewards](rewards.md)). A booking a reward made free has no pay step.                                                                                                                                                                                   |
| Refunds, deposits, receipts | None.                                                                                                                                                                                                                                                                                                            |

## How big teams do it (Stripe's docs, read Nov 10)

- **A software platform whose businesses sell to their own customers uses Stripe Connect with "direct charges".** The business is the seller, its name is on the customer's card statement, it pays Stripe's fee, and it answers refunds and disputes. The platform earns from its subscription and, if it wants, a fee per payment. ([Build a SaaS platform](https://docs.stripe.com/connect/saas), [Direct charges](https://docs.stripe.com/connect/direct-charges))
- **New work uses the Accounts v2 API**, where the platform says three things about each business's account: which Stripe dashboard it gets, who pays Stripe's fees, who covers losses. ([SaaS quickstart](https://docs.stripe.com/connect/saas/quickstart))
- **The payment page is Stripe Checkout**, Stripe's own hosted page: cards, wallets, the extra bank check some cards need, the customer's language, all done by Stripe. A session lasts 30 minutes to 24 hours. ([How Checkout works](https://docs.stripe.com/payments/checkout/how-checkout-works))
- **Believe the webhook, not the browser.** The customer can close the tab before coming back. Stripe sends `checkout.session.completed`; some ways to pay confirm later (`checkout.session.async_payment_succeeded` / `_failed`); an unpaid session sends `checkout.session.expired`.
- **Events for a business's payments arrive on a separate webhook**, the "Connected accounts" kind, not the one subscriptions use. ([Connect webhooks](https://docs.stripe.com/connect/webhooks))
- **Refunds** are made on the business's account. A platform fee is not given back unless asked (`refund_application_fee`).
- **Countries.** Stripe serves businesses in 51 countries ([stripe.com/global](https://stripe.com/global)): the US, Spain, Mexico and Brazil are in; the Dominican Republic is not.

## Decisions

- **ON1. The business is the seller; Koblip is not in the money.** Stripe Connect, direct charges. Why: it is what Stripe tells software platforms to do, and it keeps Koblip out of holding money, refunds and card disputes.
- **ON2. Each business gets a full Stripe account, Stripe paid by the business, losses covered by Stripe.** Accounts v2: `dashboard: "full"`, `fees_collector: "stripe"`, `losses_collector: "stripe"`, the `merchant` set-up with `card_payments`. Why not the lighter "Express" dashboard: with these settings it is still a public preview at Stripe and needs a preview API version; the full one is finished and is what Stripe recommends with direct charges. To revisit when Stripe finishes it.
- **ON3. Connecting is done on Stripe's own pages** (an Account Link from Settings → Payments, and back). Why: Stripe asks different things per country and changes them; its pages keep up by themselves.
- **ON4. Stripe's hosted payment page, not a card form of ours.** One redirect out and back. Why: least to build and keep safe; Apple Pay and Google Pay work with no extra set-up.
- **ON5. The business picks one of three, for all its services:** off, a deposit (a percent or a fixed amount), or the full price. A deposit's rest is paid at the visit. Per-service amounts come later if asked.
- **ON6. "Card" is one more way to pay in the existing pay step**, beside the business's own ways. The existing "Pay at the visit" switch still decides whether a customer may skip paying now. With card as the only way and that switch off, every booking is paid online.
- **ON7. The time is held, the booking is made when Stripe says paid.** A new `booking_holds` row keeps the time busy for 30 minutes (Stripe's shortest session) and carries the checked booking. Paid: the booking is created from it, as `confirmed`, through the same code as today, and every message goes out as today. Not paid: the hold is deleted and the time is free again. Why not a new "waiting for payment" booking status: every list, message, calendar sync and count in the app reads the status; a hold touches only free times.
- **ON8. Paid but the booking can no longer be made** (the service was deleted meanwhile): the payment is refunded in full at once and the customer is told. Should never happen, because the hold keeps the time; it is the safety net.
- **ON9. One function marks a payment, safe to call twice.** The webhook and the "back from Stripe" page both call it; the Stripe session id is unique in the database, so nothing is counted twice.
- **ON10. Refunds: the owner decides, with one button.** On a booking paid online: "Refund", the whole amount paid. When the owner cancels such a booking, the same question is asked there. When the customer cancels, nothing is refunded by itself: a deposit exists to be kept on a late cancel; the owner refunds if they wish. Part refunds come later.
- **ON11. No Koblip fee per payment for now.** Koblip earns from Pro, where this feature lives. The code leaves the place for a fee: one number, `ONLINE_PAY_RULES.feePercent`, at 0 (a rule in code, not an admin screen, since nobody changes it yet). Why: simplest to explain to a business, and a fee can be turned on later without new code.
- **ON12. An online payment cannot be marked "not paid" by hand.** The owner's Mark as paid button stays for outside payments only.
- **ON13. A reward comes first.** The amount to pay is worked out after the reward; a free booking still has no pay step.
- **ON14. Moving a booking keeps its payment. A no-show keeps the deposit.**
- **ON15. Businesses outside Stripe's countries are told so** in Settings → Payments ("Not in your country yet") and keep the outside ways. No fake option.
- **ON16. Amounts follow Stripe's rules per currency**: its smallest charge, and currencies with no cents. A deposit under the smallest charge is refused when the owner saves it.

## Countries

Stripe's list has 51 countries. In: United States, Spain, Mexico, Brazil, Canada, United Kingdom, most of Europe. **Not in: Dominican Republic**, and most of Central America and the Caribbean.

For those businesses this plan changes nothing; paying outside the app stays their way. A local card processor for the Dominican Republic (Azul, CardNET) or PayPal would be its own plan, with its own contract.

Confirmed in ON-1 (Stripe's sandbox, Nov 10): Koblip's US account can connect businesses in Stripe's other countries (Spain, Mexico, Brazil, Canada and the United Kingdom were tried). For the Dominican Republic Stripe answers "unsupported country". The app reads a business's country from its time zone and asks Stripe; Stripe's answer decides.

## Data

| Where                         | New                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `businesses`                  | `stripeAccountId`, `stripeChargesOn` (Stripe says it can take payments), `onlinePay` (off, deposit, full), `depositType` (percent, amount), `depositValue` |
| `booking_holds` (new)         | business, the checked booking as it will be saved, start and end, team member, amount, Stripe session id (unique), expires at                              |
| `bookings`                    | `paidOnlineMinor`, `stripeSessionId` (unique), `stripePaymentId`, `refundedMinor`, `refundedAt`                                                            |
| `online_payment_events` (new) | every Stripe event handled: its id (unique), kind, business, booking, amount, when. The admin's history, and the guard against handling one event twice.   |
| `lib/payment-rules.ts`        | payment type `card`; the deposit sum                                                                                                                       |

## Tasks

In order. Each is small, ends with its own tests, and is committed alone.

| ID    | Task                 | What                                                                                                                                                                                                                                                      | Needs      | Status |
| ----- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| ON-1  | Stripe set-up        | Turn on Connect in Koblip's Stripe sandbox; confirm the countries; write `docs/online-payments.md` (settings, the second webhook, test cards).                                                                                                            | Owner      | Done   |
| ON-2  | Rules and data       | The deposit sum, smallest charges and no-cent currencies in `lib/payment-rules.ts` with tests; the migration for the columns and tables above.                                                                                                            |            | Done   |
| ON-3  | Connect a business   | Server code to make the business's Stripe account, the Account Link, and to read whether it can take payments (`lib/stripe-connect.ts`); owner only, real businesses only, Pro only.                                                                      | ON-1, ON-2 | Done   |
| ON-4  | Webhook              | `app/api/stripe/connect/route.ts`: checks Stripe's signature, records each event once, handles paid, paid later, failed, expired, refunded, disputed and account changes.                                                                                 | ON-3       | Done   |
| ON-5  | Settings → Payments  | "Card payments" at the top: Connect Stripe, its state (not connected, more details needed, ready), then Off / Deposit / Full price with the amount. Phone first.                                                                                          | ON-3       | Done   |
| ON-6  | Holding the time     | `booking_holds`; free times count holds as busy; a timer deletes old ones. Tests: two customers, one slot.                                                                                                                                                | ON-2       | Done   |
| ON-7  | Paying when booking  | The pay step offers Card; Continue makes the hold and the Stripe session and sends the customer to Stripe; coming back shows the booking, or "Payment not finished" with Try again.                                                                       | ON-4, ON-6 | Done   |
| ON-8  | The booking shows it | "Paid online $X" and what is left to pay at the visit: the customer's booking, the owner's booking, the team area (amount only), the lists' payment badge.                                                                                                | ON-7       | Done  |
| ON-9  | Refund               | The owner's Refund button and the question on cancel; the customer's booking shows "Refunded".                                                                                                                                                            | ON-8       | To do  |
| ON-10 | Bells                | Owner: "paid online" and "payment disputed". Customer: "refunded".                                                                                                                                                                                        | ON-8       | To do  |
| ON-11 | Admin                | Admin → Online payments: each business's Stripe state and setting, every payment event; Admin → Bookings shows paid online and refunded. Read only.                                                                                                       | ON-4       | To do  |
| ON-12 | Assistant            | `list_bookings` returns what was paid online and refunded; `list_payment_methods` returns the card setting; `set_online_payment` (off, deposit, full) and `refund_booking`, both with the confirm card. Connecting Stripe is never done by the assistant. | ON-9       | To do  |
| ON-13 | Plans and home       | `onlinePayments` goes from "Soon" to live on Pro; a downgrade turns card payments off and keeps the Stripe account; home pricing and the Pro screen lose "Soon". Terms and privacy name Stripe for customer payments.                                     | ON-7       | To do  |
| ON-14 | Words and checks     | Words looked up at Apple, Google and Stripe; translations; type check, lint, tests, build; a whole run in Stripe's sandbox on a phone: connect, deposit, full price, declined card, card needing the bank check, closed tab, refund.                      | all        | To do  |

### Where the code will go

| Part                          | Files                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules (pure)                  | `lib/payment-rules.ts`, its test                                                                                                                                           |
| Stripe for businesses         | `lib/stripe-connect.ts` (server only), `app/api/stripe/connect/route.ts`                                                                                                   |
| Data                          | `lib/db/schema.ts`, `drizzle/0077_online_payments.sql`                                                                                                                     |
| Booking                       | `features/booking/api/create-booking.ts`, new `start-card-payment.ts`, `finish-card-payment.ts`, `get-availability.ts`, `components/booking-flow.tsx`, `booking-steps.tsx` |
| Owner                         | `features/dashboard/components/payments-section.tsx`, `booking-details.tsx`, `api/payment-actions.ts`, `api/payment-queries.ts`                                            |
| Customer                      | `features/customer-account/` booking page                                                                                                                                  |
| Team, admin, assistant, bells | as in [outside payments](outside-payments.md)                                                                                                                              |

## Not in this plan

- Part refunds, tips, gift cards, packages, saved cards, charging a no-show fee to a saved card.
- A different amount per service.
- A Koblip fee per payment (the place is left for it, ON11).
- Payments in countries Stripe does not serve.
- Card readers at the business.
- Reports of money received (Stripe's own dashboard has them).
- Invoices and tax on the business's sales.

## Risks

- **Countries.** The owner's home market cannot use this. The plan says so plainly instead of hiding it.
- **Stripe asks businesses for documents.** Some will stop halfway. The settings screen shows "More details needed" with one button back to Stripe.
- **Disputes.** A customer can dispute a card payment at their bank. With ON2 that is between the business and Stripe; Koblip only shows it.
- **Two webhooks.** Subscriptions keep theirs. The new one has its own secret; mixing them up breaks both, so ON-1 writes the set-up down.
- **A held time nobody pays for** is busy for up to 30 minutes. Accepted: it is Stripe's shortest session.

## Needs the owner

1. **Go.** (Answered Nov 10: Koblip's Stripe account is in the United States. ON-1 confirms in the Stripe dashboard which countries it can connect businesses from.)
2. **Fee:** answered Nov 10: no Koblip fee per payment (ON11).
3. **Pro only** (ON-13): answered Nov 10: yes.

## Next step

The next task marked "To do" in the table.
