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
  Plans) that sets, for each feature, the lowest plan that has it, with
  group chips (`FilterChips`) and the app's switcher (`ViewTabs`). Pro
  always has everything Free has. Until P1 ships, no feature checks a plan:
  every business keeps everything. Big teams call this entitlements;
  Stripe has the same idea (Entitlements), and ours stays the source of
  truth so a plan change needs no Stripe edit. (Backend dev)
- **S10. Defaults**: every built feature on Free; every "Coming soon"
  feature on Pro (as the home page says). Stored choices go over the
  defaults; a feature removed from the list drops its stored row's effect.
  No change log (owner, 2026-11-06: not needed); each row keeps who set it
  last (`updatedBy`). (Backend dev)
- **S11. A business that never paid is on Free** (owner, 2026-11-06,
  replacing "nothing locks before billing"). `businessPlan()` always reads
  the subscription; there is no switch. Free's limits (O4) apply to
  everyone today, and a feature the admin moves to Pro locks for every
  business that hasn't paid, so move one only once the live site can take
  payments (docs/billing.md).
- **S12. Only checked features move.** Admin → Plans lets a built feature
  leave its default plan only once its code asks for the plan
  (`PLAN_CHECKED_FEATURES`); `lib/plan-checks.test.ts` fails if that list
  and the code disagree. A locked page shows "Part of Pro" with one
  action (`components/plan-locked.tsx`); a locked action returns
  `locked`; background work (WhatsApp flows) skips. (Backend dev)
- **S13. No trial** (O2): the plugin's `freeTrial` stays off, and P6 sends
  no trial emails. (Backend dev, 2026-11-06)
- **S14. Prices before tax** (`tax_behavior: exclusive`): $19 is the
  price, and Stripe Tax adds tax on top where it's owed, as US software
  prices usually show. Set in the sandbox on 2026-11-06: product
  `koblip_pro` (tax code `txcd_10103001`), prices `koblip_pro_monthly`
  ($19/month) and `koblip_pro_yearly` ($190/year). Live mode gets the same
  in P3. (Backend dev)
- **S15. A downgrade stops what runs on its own, not only the screens.**
  Google Calendar sends and reads nothing and its busy times block nothing;
  messages go from Koblip's number instead of the business's own; the team
  area and its saves lock; automations already only run with the plan.
  Nothing is deleted, so all of it picks up again on upgrading (S7). A
  feature still without a check (bookings, services, the booking page…)
  gets one only when it moves to a paid plan; today's checked list covers
  what Pro is meant to hold. When more page themes ship, the public page
  falls back to the default theme without `pageThemes`. (Backend dev)
- **S8. Secrets** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only in
  `.env.local`; Stripe test mode on the Mac, live keys only on the server.

## Owner's answers (2026-11-06)

- **O1. Price.** Pro is $19 a month, or $190 a year (2 months free).
- **O2. Trial.** No trial: Pro starts when paid.
- **O3. Free stays free.** Everything free today stays free forever; Pro
  adds the "Soon" features and higher limits.
- **O4. Messages from Koblip's number.** Free: 30 template messages a
  month. Pro: 200. Both are admin rules (WhatsApp rules, Usage); a
  business's own limit, set by the admin, wins over its plan's.

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| P0 | Feature list (`lib/plan-features.ts`), `plan_features` table, `featurePlans()` and `setFeaturePlan()` (`lib/plan-access.ts`), Admin → Plans with each feature's plan | | Done (2026-11-06) |
| P1 | Packages: `better-auth` and `@better-auth/stripe` 1.7.18, `stripe` ^23; plugin in `lib/auth.ts` and `stripeClient` in `lib/auth-client.ts`, plan list in `lib/subscription-rules.ts`; migration for `subscription` and `user.stripeCustomerId` (0064). Off until both Stripe keys are in `.env.local` (`lib/stripe.ts`); the Stripe customer is made at first checkout; any `referenceId` is refused until P2 | | Done (2026-11-06) |
| P2 | `authorizeReference` (owner of a real business only, `canBillBusiness`), an auth hook that refuses an upgrade without a business, and `businessPlan()` reading paid subscriptions (`subscribedPlan`) in `lib/plan-access.ts`, with tests | P1 | Done (2026-11-06) |
| P3 | Stripe set-up doc `docs/billing.md`: product, prices with lookup keys, tax code `txcd_10103001`, Stripe Tax, portal settings, webhook URL and events, test clocks. Sandbox set up (product, prices, portal, Stripe Tax head office); live mode and tax registrations are steps for the owner in the doc | P1 | Done (2026-11-06) |
| P4 | Owner screen Settings → Plan (`features/billing`): current plan, monthly or yearly, Upgrade (Checkout), Manage billing (portal); its own ESLint zone; 4 languages | P2 | Done (2026-11-06): `features/billing`; shown once the Stripe keys are set, never on a demo copy; Checkout with automatic tax and tax ids |
| P5a | Plan checks for 11 features (page, actions, routes): analytics, widgets, page themes, more than one business, assistant by typing and by voice, AI writing, WhatsApp automations, own WhatsApp number, team accounts, Google Calendar | P0 | Done (2026-11-06) |
| P5b | Locked entry points: a plan badge on the menu's Analytics, Widgets and assistant pages (they open the "Part of Pro" screen); the floating assistant and Home's assistant box hide | P5a | Done (2026-11-06) |
| P5e | Plan badge on Settings' tabs (Theme) and in Search; the phone tab bar's assistant button hides when the assistant is locked | P5b | Done (2026-11-06) |
| P5c | Downgrades stop background work for every checked feature (S15): Google Calendar sync and busy times, the own WhatsApp number, the team area; automations already did | P5a | Done (2026-11-06) |
| P5d | Monthly templates on Koblip's number by plan (O4): rules `koblipMonthlyTemplates` (Free) and `koblipMonthlyTemplatesPro`, `koblipTemplateLimit()` in `lib/koblip-usage.ts`; the sender and Admin → Usage read it | P2, O3 | Done (2026-11-06) |
| P6 | Emails to the owner, in their language, linking to Settings → Plan (`lib/billing-emails.ts`, the Stripe plugin's hooks): payment failed, once when the subscription moves into `past_due`; back to Free, when it ends. An owner who signed up by phone has no email, so gets neither | P2 | Done (2026-11-06) |
| P7 | Admin screen Subscriptions: every business's plan, status, renewal date, Stripe links, history; admin can give Pro for free (a 100% coupon in Stripe, logged) | P2 | To do |
| P8 | Home pricing: Pro's button opens sign-up then Checkout; "Soon" goes; prices read from `lib/pricing-rules.ts` | P4, O3 | To do |
| P9 | Terms and privacy: price, cancelling, refunds, Stripe as processor; owners told before the first charge (Terms already promise this) | O1, O2 | To do |
| P10 | Tests and live checks in Stripe test mode: upgrade monthly and yearly, cancel, restore, failed card, two businesses on one owner | P1–P8 | To do |

## Decisions log

| Date | Who | Decision |
| --- | --- | --- |
| 2026-11-06 | Backend dev | S1–S8 above, from the docs and the audit |
| 2026-11-06 | Owner | S9: features-by-plan screen first |
| 2026-11-06 | Backend dev | S10: defaults and the change log |
| 2026-11-06 | Owner | Plans page: no change log; group chips; the app's switcher |
| 2026-11-06 | Owner | O1–O3: $19/month or $190/year; no trial; free stays free |
| 2026-11-06 | Owner | O4: 30 template messages a month on Free, 200 on Pro |
| 2026-11-06 | Owner | S11: every business that hasn't paid counts as Free now; the billingLive switch is gone |
| 2026-11-06 | Backend dev | S14: prices before tax; Pro product and prices made in the Stripe sandbox |
| 2026-11-06 | Backend dev | S15: what a downgrade stops; other features get checks only when they move to a paid plan |
| 2026-11-06 | Backend dev | S11, S12: nothing locks before billing; only checked features move |
