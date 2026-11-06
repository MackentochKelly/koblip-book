# App subscriptions

How businesses pay for Koblip Book: a Free plan and a paid Pro plan, billed
by Stripe through Better Auth's Stripe plugin. Asked by the owner
(2026-11-06). Nothing is built until the owner says go.
How to use this file: [Plans](README.md).

## What is there today (audit, 2026-11-06)

- **Home page pricing** (`components/home-pricing.tsx`, `lib/pricing-rules.ts`,
  words in `lib/i18n/en/public.ts` → `public.home.pricing`): Free at $0 and
  Pro at $19/month marked "Soon" with a disabled button. Pro lists:
  payments with Stripe, SMS reminders, Book buttons on Instagram and
  Facebook, Google review requests.
- **None of Pro's features exist yet.** Each is a "Coming soon" card in
  Integrations (`features/dashboard/components/integrations-view.tsx`).
  So a Pro subscription would unlock nothing today (see O3).
- **Terms** (`public.legal…price`): "free for now; we will tell you well
  before any charge starts". Owners must be told before Pro is sold.
- **Limits already in code**: `koblipMonthlyTemplates` (300 WhatsApp
  templates a month from Koblip's number, per business, admin can change
  per business: `lib/platform-settings.ts`, `lib/koblip-usage.ts`);
  `businesses.seats`.
- **Accounts**: Better Auth 1.7.14 (`lib/auth.ts`) with admin, anonymous and
  phone-number plugins; one owner may own several businesses
  (`businesses.ownerId`, `/dashboard/new`). No organization plugin.
- **No billing code, no Stripe package, no Stripe keys.**

## Research (official docs)

- **Better Auth Stripe plugin** (better-auth.com/docs/plugins/stripe):
  `@better-auth/stripe` 1.7.18 (needs `better-auth` ^1.7.18) and
  `stripe` ^23. Plans have `name`, `priceId`/`lookupKey`,
  `annualDiscountPriceId`, `limits`, `freeTrial: { days, onTrialStart,
  onTrialEnd, onTrialExpired }`. Billing a custom `referenceId` is allowed
  with `authorizeReference`. Hooks: `onSubscriptionComplete`, `…Update`,
  `…Cancel`, `…Deleted`. Client: `subscription.upgrade`, `list`, `cancel`,
  `restore`, `billingPortal`. Webhook `/api/auth/stripe/webhook` with
  `checkout.session.completed`, `customer.subscription.created`,
  `…updated`, `…deleted`. Adds a `subscription` table and
  `user.stripeCustomerId`. One trial per user, ever (built in). One active
  subscription per reference.
- **Stripe Billing** (docs.stripe.com/billing): Stripe-hosted Checkout in
  subscription mode is the least-code path; the Customer Portal handles
  card changes, invoices and cancelling. `customer.subscription.trial_will_end`
  fires 3 days before a trial ends.
- **Stripe Managed Payments** (merchant of record, Stripe handles VAT/sales
  tax in 80+ countries): Checkout only, digital products only, Stripe
  reviews eligibility, and it **does not allow Connect on the same
  account**. Pro's "Payments with Stripe" for businesses needs Connect.

## Decisions

- **S1. Stripe, through Better Auth's Stripe plugin.** It keeps the user,
  session and subscription in the one auth system, and Pro already names
  Stripe. No custom webhook code. (Backend dev, 2026-11-06)
- **S2. A plan belongs to a business, paid by its owner.** `referenceId` is
  the business id; `authorizeReference` lets only that business's owner
  (`businesses.ownerId`) act. One Stripe customer per owner, so one card and
  one portal for all their businesses. No organization plugin. (Backend dev)
- **S3. Stripe-hosted Checkout and the Customer Portal.** No card form of
  our own: Stripe's pages handle cards, 3-D Secure, invoices and receipts
  in the owner's language. (Backend dev)
- **S4. Tax with Stripe Tax on Koblip's own account, not Managed
  Payments**, so the same account can later run Connect for Pro payments.
  Turned on through `getCheckoutSessionParams` (`automatic_tax`). Revisit
  if the owner prefers Stripe to be merchant of record (then billing needs
  its own Stripe account). (Backend dev)
- **S5. Prices live in Stripe, looked up by `lookupKey`**
  (`koblip_pro_monthly`, `koblip_pro_yearly`), so a price change needs no
  deploy; `lib/pricing-rules.ts` keeps only what the home page shows and a
  test checks it matches. (Backend dev)
- **S6. One check for "has Pro"**: `businessPlan(businessId)` in the DAL
  (`lib/dal.ts`), `active` or `trialing` counts. Every Pro feature and limit
  reads it on the server; the UI only shows what the server allows. (Backend dev)
- **S7. Failed payment**: Stripe's Smart Retries, then the subscription ends
  and the business drops back to Free. Nothing is deleted; Pro settings
  stay stored and wake up again on resubscribing. (Backend dev)
- **S9. Features by plan first** (owner, 2026-11-06). One list of every
  feature in code (`lib/plan-features.ts`), and an admin screen (Admin →
  Plans) that sets, for each feature, the lowest plan that has it. Pro
  always has everything Free has. Until P1 ships, no feature checks a plan:
  every business keeps everything. Big teams call this entitlements;
  Stripe has the same idea (Entitlements), and ours stays the source of
  truth so a plan change needs no Stripe edit. (Backend dev)
- **S10. Defaults**: every built feature on Free; every "Coming soon"
  feature on Pro (as the home page says). Stored choices go over the
  defaults; a feature removed from the list drops its stored row's effect.
  Every change is logged (who, when, before, after). (Backend dev)
- **S11. Nothing locks before billing.** `SUBSCRIPTION_RULES.billingLive`
  (`lib/subscription-rules.ts`) is false until P1: every business counts as
  on the top plan. `businessPlan()` reads the subscription from P2 on.
  (Backend dev, 2026-11-06)
- **S12. Only checked features move.** Admin → Plans lets a built feature
  leave its default plan only once its code asks for the plan
  (`PLAN_CHECKED_FEATURES`); `lib/plan-checks.test.ts` fails if that list
  and the code disagree. A locked page shows "Part of Pro" with one
  action (`components/plan-locked.tsx`); a locked action returns
  `locked`; background work (WhatsApp flows) skips. (Backend dev)
- **S8. Secrets** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only in
  `.env.local`; Stripe test mode on the Mac, live keys only on the server.

## Open (owner's call)

- **O1. Price.** Keep Pro at $19/month? A yearly price (e.g. 2 months
  free)?
- **O2. Trial.** Pro trial length, and with or without a card?
- **O3. What Free keeps and Pro adds.** Proposed: everything free today
  stays free forever; Pro adds the four "Soon" features and higher limits
  (more WhatsApp messages a month). Pro is sold only once its first feature
  ships.

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| P0 | Feature list (`lib/plan-features.ts`), `plan_features` and `plan_feature_changes` tables, `featurePlans()` and `setFeaturePlan()` (`lib/plan-access.ts`), Admin → Plans with each feature's plan and the change log | | Done (2026-11-06) |
| P1 | Packages: `better-auth` and `@better-auth/stripe` 1.7.18, `stripe` ^23; plugin in `lib/auth.ts` and `stripeClient` in `lib/auth-client.ts`, plan list in `lib/subscription-rules.ts`; migration for `subscription` and `user.stripeCustomerId` | O1, O2 | To do |
| P2 | `authorizeReference` (owner of the business only) and `businessPlan()` in `lib/dal.ts`, with tests | P1 | To do |
| P3 | Stripe set-up doc `docs/billing.md`: product, prices with lookup keys, tax code `txcd_10103001`, Stripe Tax, portal settings, webhook URL and events, test clocks | P1 | To do |
| P4 | Owner screen Settings → Plan (`features/billing`): current plan, trial days left, Upgrade (Checkout), Manage billing (portal); its own ESLint zone; 4 languages | P2 | To do |
| P5a | Plan checks for 11 features (page, actions, routes): analytics, widgets, page themes, more than one business, assistant by typing and by voice, AI writing, WhatsApp automations, own WhatsApp number, team accounts, Google Calendar | P0 | Done (2026-11-06) |
| P5b | Locked entry points: a plan badge on the menu's Analytics, Widgets and assistant pages (they open the "Part of Pro" screen); the floating assistant and Home's assistant box hide | P5a | Done (2026-11-06) |
| P5e | Plan badge on Settings' tabs (Theme) and in Search; the phone tab bar's assistant button | P5b | To do |
| P5c | Plan checks for the other built features, one at a time; Google Calendar sync and automations stop on a downgrade | P5a | To do |
| P5d | `koblipMonthlyTemplates` per plan (Pro limit in `lib/subscription-rules.ts`) | P2, O3 | To do |
| P6 | Emails: trial ends in 3 days, payment failed, back to Free (Better Auth hooks + `customer.subscription.trial_will_end`) | P2 | To do |
| P7 | Admin screen Subscriptions: every business's plan, status, trial end, Stripe links, history; admin can give Pro for free (a 100% coupon in Stripe, logged) | P2 | To do |
| P8 | Home pricing: Pro's button opens sign-up then Checkout; "Soon" goes; prices read from `lib/pricing-rules.ts` | P4, O3 | To do |
| P9 | Terms and privacy: price, trial, cancelling, refunds, Stripe as processor; owners told before the first charge (Terms already promise this) | O1, O2 | To do |
| P10 | Tests and live checks in Stripe test mode: trial, upgrade, cancel, restore, failed card, two businesses on one owner | P1–P8 | To do |

## Decisions log

| Date | Who | Decision |
| --- | --- | --- |
| 2026-11-06 | Backend dev | S1–S8 above, from the docs and the audit |
| 2026-11-06 | Owner | S9: features-by-plan screen first |
| 2026-11-06 | Backend dev | S10: defaults and the change log |
| 2026-11-06 | Backend dev | S11, S12: nothing locks before billing; only checked features move |
