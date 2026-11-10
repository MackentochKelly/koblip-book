# Rewards

Each business sets its own rewards for coming back: "after 5 visits, 1 free haircut", "after 10 visits, 20% off", "after $300 spent, $25 off". Customers earn by booking and redeem a reward on a later booking. Asked by the owner (Nov 10): "After (# of service) get (# of service) free, or (#) percentage etc... very flexible, this is a SaaS."

**Status (Nov 10):** The owner said go. RW-1 to RW-6 are built and committed, with tests: rules can be made, visits are counted, and a signed-in customer can redeem when booking. RW-7 to RW-16 are to do. Nothing pushed or deployed. The live server needs the new migration (`0076_rewards`) at the next deploy.

## Rules that stay

- Koblip never moves money. A reward only changes the price a booking shows and stores; the money is still paid outside the app and only the owner marks a booking paid.
- A business with no reward sees none of this, and neither do its customers.
- Nothing stored is hidden from the app admin.
- A feature never imports another feature: everything shared lives in `lib/`.
- Same data and code in Luma and Nova. Tokens only. shadcn parts only. Phone first.
- English words only; Spanish, Portuguese and French come from the translation run.

## What exists today

| Part | Today |
| --- | --- |
| Price | `bookings.priceMinor` is the total (service + extras), copied from `services.priceMinor` when booked (`features/booking/api/create-booking.ts`, `create-owner-booking.ts`). No discount of any kind anywhere. |
| A visit that happened | One rule already: confirmed or completed, and ended (`isEarned`, `EARNING_STATUSES` in `lib/booking-rules.ts`). The Customers page counts "spent" with it. Cancelled and no-show never count. |
| Status changes | Owner: `setBookingStatus` (`features/dashboard/api/booking-actions.ts`), cancel in `features/dashboard/api/actions.ts`. Customer: `lib/customer-cant-come.ts`. Nothing happens when a booking simply ends: no event, only time passing. |
| Who a customer is | Per business, by phone: `bookings.customer_key` (`lib/customer-key.ts`), same key on `customers`. The phone typed when booking is **not checked**. A signed-in account may have a phone proved by a sign-in code (`lib/customer-dal.ts`); `ownBookings` (`lib/customer-bookings.ts`) uses it. |
| Owner's view of a customer | Customers page: visits, no-shows, spent (`features/dashboard/api/customers.ts`, `customers-view.tsx`). |
| Customer's account | My bookings, Places, Profile, Settings (`features/customer-account/nav.ts`, `app/(customer)/account/`). |
| Payment step | `startPayment` (`lib/payment-rules.ts`) asks for a way to pay whenever the business lists one, whatever the price. |
| Messages | WhatsApp booking messages carry the booking's price (`features/dashboard/utils/booking-templates.ts`), each a Meta template with fixed words. Bells: `types/in-app-notifications.ts`. |
| Timers | The server already runs timers started in `instrumentation.ts` (`lib/payment-proof-timer.ts`). |
| Assistant | 59 tools (`app/api/assistant/tools.ts`), changes go through the confirm card. None about rewards. |
| Admin | 15 screens (`features/admin/components/admin-shell.tsx`). None about rewards. |
| Plans | `lib/plan-features.ts` lists every feature and its plan. |

## The main problem

Two things, and the plan turns on both:

1. **A reward is worth money, and a typed phone number proves nothing.** Customers are grouped by the phone they type. If a typed phone could spend a reward, anyone who knows a regular's number could book their free haircut, and anyone could read how often they visit.
2. **Visits get undone.** A booking counted today can be marked no-show or cancelled tomorrow. A simple counter on the customer would drift. Every product looked at keeps a history of events instead, and reverses.

## How big teams do it (researched Nov 10)

| Product | What earns | Reward | Counts when | Undo |
| --- | --- | --- | --- | --- |
| Square Loyalty | Visit (with a minimum amount), amount spent, an item, a category | Percent or fixed amount off, free item; whole sale, category or item; a cap | Order completed | Points adjust on refund; seller adjusts by hand with a reason; balance may go negative |
| Fresha | Purchase, completed appointment, online booking, review; minimum value, cap | Amount off, percent off, free service; minimum spend, expiry, chosen services | Not confirmed | Not confirmed |
| Booksy | A stamp per qualifying appointment; minimum value; 1–15 stamps | One reward the owner writes | Not confirmed | Not confirmed |
| Vagaro | Points set per service | Points to redeem per service | After checkout | Not confirmed |
| Smile, LoyaltyLion (Shopify) | Order, per amount or fixed | Amount off, percent off, free product | Order paid; LoyaltyLion holds points "pending" first | Removed on refund, in proportion |
| Stripe coupons | (not loyalty) | `percent_off` or `amount_off`, `applies_to` products, `redeem_by`, `max_redemptions` | | A coupon cannot be edited after it is made, only renamed |

What they share, and this plan copies:

- A **rule** is "what earns" + "how much is needed" + "what you get" + limits. Never one fixed shape.
- A **history that is never edited** (Square: `ACCUMULATE_POINTS`, `CREATE_REWARD`, `REDEEM_REWARD`, `DELETE_REWARD`, `ADJUST_POINTS`, `EXPIRE_POINTS`). The balance is the sum.
- An earned reward is its **own record** with a state (Square: issued → redeemed, or deleted and given back).
- Earning needs a **finished** visit, and is reversed when the visit is undone.
- The customer is found by **phone number** (Square).
- The words: "Rewards", "earn", "redeem" (Apple, Microsoft, Square).

Sources: [Square Loyalty API](https://developer.squareup.com/docs/loyalty-api/overview), [Square rewards](https://developer.squareup.com/docs/loyalty-api/loyalty-rewards), [Square event types](https://developer.squareup.com/reference/square/objects/LoyaltyEventType), [Fresha rewards](https://www.fresha.com/help-center/knowledge-base/clients/102217-create-client-loyalty-rewards), [Booksy loyalty cards](https://biz.booksy.com/en-us/features/digital-loyalty-cards), [Smile order settings](https://help.smile.io/en/articles/4036177-update-order-settings-shopify), [LoyaltyLion refunds](https://help.loyaltylion.com/en/articles/1965601-refunds-and-returns-on-purchased-products), [Stripe coupons](https://docs.stripe.com/api/coupons/object). Booksy's and Vagaro's help pages could not be opened; their rows come from their public feature pages and search results.

## Decisions

- **RW1. One general rule, many per business.** A reward rule has four parts:
  - **Earn**: `visit` (each booking counts 1) or `spend` (each booking counts its price). Limited to chosen services, or all. Optional minimum price for a booking to count.
  - **Goal**: how many visits, or how much spent.
  - **Reward**: `free` (the service is free), `percent` (X% off) or `amount` (a fixed amount off). Usable on chosen services, or all. `count`: how many bookings it covers ("get 2 free" = 2).
  - **Limits**: days until an earned reward expires, a start and end date for the rule, how many times one customer can earn it, a cap on the discount, "only paid bookings count".

  A business can run up to 10 rules at once (`REWARD_RULES.maxRules`), each with its own count per customer, so "5 haircuts → 1 free haircut" and "$300 spent → $25 off" live side by side. Why not one points balance like Square: the owner's own examples are per-service counts, and a points balance cannot say "5 haircuts" and "5 manicures" apart. Why not a fixed "N then M free": it could never do percent, amount or spend.
- **RW2. A history, never a counter.** Every change is one row in `reward_events`, never edited or deleted: `earn`, `reverse`, `adjust`, `convert` (the goal was reached, a reward was made), `expire`. A customer's progress on a rule is the sum. Why: Square does it this way; it survives undo, it explains every number to the owner, and the admin can see everything.
- **RW3. An earned reward is its own record** (`rewards`), one row per booking it covers, holding a copy of what the rule gave **when it was earned**. Changing or turning off a rule never changes rewards already earned (as a Stripe coupon cannot be edited once made). States: `available` → `held` (on an upcoming booking) → `used` (the visit happened); or `expired`, `removed`.
- **RW4. A visit counts when it happened**: the booking has ended and is confirmed or completed, the app's one existing rule (`isEarned`). Not when it is booked. A server timer counts ended bookings (nothing else fires when time passes); marking a booking completed counts it at once. Each booking counts once per rule (a unique index, so a retry can never count twice).
- **RW5. Undo is automatic.** A counted booking later marked no-show or cancelled writes a `reverse`. If that takes the customer under the goal and the reward is still unused, the reward is removed. If it was already used, the progress goes below zero and the next visits pay it back (Square allows a negative balance for the same reason). Nobody has to remember to fix it.
- **RW6. "Only paid bookings count" is a switch on the rule**, off by default, shown only when the business lists a way to pay. On: a booking counts when it has ended **and** the owner marked it paid. Why a switch: most businesses here are paid at the visit and never mark anything.
- **RW7. Earning needs nothing from the customer. Redeeming online needs a proved phone.** Visits are counted by `customer_key`, signed in or not, also for bookings the owner adds. But a reward is shown and redeemed on the booking page only for a signed-in account whose phone was proved by a sign-in code and matches. Everyone else sees one line, "Sign in to see your rewards". This closes the main problem: a typed number can neither spend nor read anything.
- **RW8. The owner can always redeem for a customer**, on a booking they add or one already made (the customer is standing in front of them), and can add or remove visits by hand with a short reason. Every such change is an `adjust` row with who did it.
- **RW9. The price stays honest.** `bookings.priceMinor` stays "what is to pay", now after the reward, so the Customers page's "spent", Analytics and the WhatsApp price field are right with no change. Two new fields keep the rest: `reward_id` and `reward_discount_minor`. The price before the reward is the sum of the two.
- **RW10. A reward covers the service, not the extras.** "Free haircut" makes the haircut free; add-ons picked with it are still paid. Percent and amount also apply to the service's own price, never below zero. A service with no price cannot take a reward.
- **RW11. One reward per booking.** No stacking (Square: one per line). With several available, the booking page offers the one that saves the most; the customer can pick another.
- **RW12. A booking that became free asks for no payment.** When the reward brings the total to 0, the pay step and payment proof are skipped, as for a business with no way to pay. Checked on the server in `startPayment`, not only on the screen.
- **RW13. A free booking does not earn.** A booking made free by a reward counts for nothing, so free visits cannot earn free visits. A booking with a percent or amount reward counts as a visit, and for spend rules counts what is really to pay (Square counts the amount after discounts).
- **RW14. Cancel gives it back.** Cancelling or a no-show on a booking that holds a reward makes the reward `available` again, with its old expiry date. Moving a booking keeps its reward. Expiry is checked on the day of booking, not the day of the visit.
- **RW15. Turning a rule off stops earning, nothing else.** Rewards already earned stay usable until they expire. A rule with history is never deleted, only ended, so the history keeps its meaning. A rule nobody earned on can be deleted.
- **RW16. Its own page, "Rewards", in the owner's menu**, in the "business" group beside Services and Automations, not a Settings tab: it is a marketing tool the owner comes back to (Square puts Loyalty at the top level). Two tabs: Rewards (the rules) and Activity (the history). The editor is a sheet, built as one sentence with pickers: "After [5] [visits] of [Any service] → [Free service] [Haircut]", limits under "More options".
- **RW17. Shown on the public page.** A business with an active rule gets a small "Rewards" block on its page ("5 visits → 1 free Haircut"). It is marketing; hiding it would defeat the point. Only the rule is public, never anyone's count.
- **RW18. Bells, not WhatsApp, for now.** The customer's bell gets "You earned a reward". WhatsApp messages are Meta templates with fixed words; a new one means a review per business in four languages (same reason as outside payments, OP1). Left for the owner to ask for.
- **RW19. Plan feature.** `rewards` is added to `lib/plan-features.ts` (dashboard group, Free by default) and checked before any rule is saved, so Admin → Plans can move it to Pro later without code.
- **RW20. Admin sees everything, changes nothing.** New screen Admin → Rewards: every business's rules, every earned reward, the whole history.
- **RW21. The assistant uses the same server code and the confirm card** for every change, like payments (OP4). It can read rules and a customer's rewards, make and change rules, and adjust visits.
- **RW23. Changed while building (Nov 10).**
  - RW4 said a unique index stops a booking counting twice. Built instead: each look at a booking writes only the difference between what it counts for now and what the history already holds for it, inside the business's booking turn. Why: a booking can be counted, undone (no-show) and counted again (back to confirmed), which one fixed row per booking cannot say.
  - A no-show or cancel on a booking that used a reward also puts the booking's price back to what it was before the reward.
  - "Ends on" (a rule's end date) is stored and obeyed, but the editor has no field for it yet: see RW-5b.
  - With several rewards usable on a service, the booking page offers the one that saves the most. Picking another one (RW11) is not built: see RW-6b.
  - The redeem switch is on the details step, not the pay step: a free booking has no pay step.
- **RW22. Words.** "Rewards", "Earn", "Redeem", "visits" (Apple, Microsoft and Square all say earn and redeem). One word per thing: never "loyalty", "points", "stamps" or "coupon" on screen.

## Data

One migration, new tables and new fields only. SQLite, Drizzle, in `lib/db/schema.ts`.

| Table | Fields |
| --- | --- |
| `reward_rules` | `id`, `business_id` (cascade), `status` (`active`, `off`, `ended`), `earn_type` (`visit`, `spend`), `earn_min_price_minor`, `goal` (visits, or minor units), `reward_type` (`free`, `percent`, `amount`), `reward_value` (percent, or minor units; null for free), `reward_count` (default 1), `max_discount_minor`, `expires_days`, `starts_at`, `ends_at`, `max_per_customer`, `paid_only`, `position`, timestamps. Index: business, position. |
| `reward_rule_services` | `rule_id` (cascade), `service_id` (cascade), `role` (`earn`, `reward`), `business_id`. No row for a role = every service. Why a table and not a list in a field: deleting a service cleans itself up. |
| `reward_events` | `id`, `business_id` (cascade), `rule_id`, `customer_key`, `type` (`earn`, `reverse`, `adjust`, `convert`, `expire`), `amount` (signed), `booking_id` (set null), `actor` (`system`, `owner`, `assistant`), `actor_user_id`, `note`, `created_at`. Index: rule, customer. Unique: rule, booking, type (where booking is set). Rows are only ever added. |
| `rewards` | `id`, `business_id` (cascade), `rule_id`, `customer_key`, `reward` (JSON copy: type, value, service ids and names, cap), `status` (`available`, `held`, `used`, `expired`, `removed`), `earned_at`, `expires_at`, `event_id`. Index: business, customer, status. |
| `bookings` (new fields) | `reward_id` (unique where set, so one reward can never be on two bookings), `reward_discount_minor`, `rewards_counted_at` (so the timer finds what is left to count). |

## Tasks

In order. Each is small and ends with its own tests. RW-1 to RW-6: `Done` (Nov 10). The rest: `To do`.

| ID | Task | Done when |
| --- | --- | --- |
| RW-1 | Rules, no screen | `lib/reward-rules.ts`: limits (`REWARD_RULES`), types, `checkRewardRule` (validates one rule from a form), `rewardDiscount(rule copy, service price)` , `bestReward`, `ruleSentence` parts. Pure, no database. Tests: free, percent, amount, cap, never below zero, no price = no reward, each refusal. |
| RW-2 | Data | The four tables and three booking fields above, one migration. `rewards` in `lib/plan-features.ts`. |
| RW-3 | Counting | `lib/rewards.ts` (`server-only`): `countBooking`, `uncountBooking`, `progressFor`, `availableRewards`; reaching the goal writes `convert` and makes the reward rows in one transaction. Tests: counts once, goal reached twice in one go, reverse removes an unused reward, reverse after use goes negative, paid-only, minimum price, chosen services, start and end dates, max per customer, free booking does not earn. |
| RW-4 | Timer and hooks | `lib/rewards-timer.ts` started in `instrumentation.ts`: counts ended bookings, expires rewards. `setBookingStatus`, the owner's cancel, `setBookingPaid` and `lib/customer-cant-come.ts` call the counting code. Tests: each path. |
| RW-5 | Owner: the page | `/dashboard/[businessId]/rewards`: list of rules as sentences with a switch each, "Add reward" as the one main action, the sheet editor, empty state = title + one action. Entry in `features/dashboard/navigation.ts`. Server actions check owner, plan and input. |
| RW-5b | "Ends on" in the editor | A day picker with a way to clear it; the day ends in the business's time zone (the zoned-time helper moves from `features/booking/utils` to `lib/`). |
| RW-6b | Pick another reward | When more than one reward fits the service, a choice instead of the one switch. |
| RW-6 | Redeem when booking | Booking page: a signed-in customer with a proved phone sees their reward on the summary with "Redeem"; the total updates; a total of 0 skips the pay step. `createBooking` checks the reward again inside the booking turn and saves booking and reward together. Tests: someone else's reward refused, expired refused, wrong service refused, two tabs cannot spend one reward, cancel gives it back. |
| RW-7 | Customer: see it | After booking and on the booking's own page: "Reward: Free Haircut" and the price before and after. New "Rewards" page in the account (`features/customer-account/nav.ts`): per business, progress ("3 of 5 visits") and rewards with their expiry. Signed out on a booking page: "Sign in to see your rewards". |
| RW-8 | Owner: per customer | Customers page, the customer's panel: progress per rule, rewards, history, "Add visits" / "Remove visits" with a reason, "Give reward". Booking details and the add-booking panel: "Redeem" when the customer has one, and the reward shown on a booking that used one. |
| RW-9 | Owner: activity | The Activity tab: the history, newest first, filter by rule; counts on top (customers earning, rewards waiting, rewards used). |
| RW-10 | Public page | "Rewards" block on the business page for active rules. `features/business-page/`. |
| RW-11 | Bells | Kind `clientRewardEarned`, saved with the `convert`. On/off with the client's other notifications. |
| RW-12 | Team area | A member's own booking shows that a reward was used. Read only. |
| RW-13 | Admin | Admin → Rewards: rules per business, earned rewards, full history; Admin → Bookings shows the reward on a booking. Read only, real businesses only. |
| RW-14 | Assistant | `list_rewards`, `customer_rewards`, `save_reward`, `turn_reward_on_off`, `remove_reward`, `adjust_customer_visits` (confirm card for the last four); `list_bookings` returns the reward used; `business_overview` counts rewards waiting. |
| RW-15 | Clean-up | Business delete and demo purge take everything with them (cascade, tested). Service delete drops it from rules; a rule left with a chosen-services list that became empty is turned off, not widened to every service. |
| RW-16 | Words and checks | New words translated; type check, lint, tests, build; phone (375 and 320) and computer, Luma and Nova, light and dark. |

### Where the code will go

| Part | Files |
| --- | --- |
| Rules (pure) | `lib/reward-rules.ts`, `lib/reward-rules.test.ts` |
| Counting, reading | `lib/rewards.ts`, `lib/rewards-timer.ts`, `instrumentation.ts` |
| Data | `lib/db/schema.ts`, `drizzle/0076_rewards.sql`, `lib/plan-features.ts` |
| Booking | `features/booking/api/create-booking.ts`, `create-owner-booking.ts`, `features/booking/api/rewards.ts` (what this customer can redeem here), `features/booking/components/booking-flow.tsx`, `booking-steps.tsx`, `features/booking/types.ts`, `lib/payment-rules.ts` (`startPayment` with a total of 0) |
| Owner | `app/(owner)/dashboard/[businessId]/rewards/`, `features/dashboard/api/reward-actions.ts`, `reward-queries.ts`, `features/dashboard/components/rewards-view.tsx`, `reward-editor.tsx`, `reward-activity.tsx`, `customer-rewards.tsx`, `booking-details.tsx`, `add-booking-panel.tsx`, `customers-view.tsx`, `navigation.ts`, `api/booking-actions.ts`, `api/actions.ts`, `api/payment-actions.ts` |
| Customer | `app/(customer)/account/rewards/`, `features/customer-account/api/my-rewards.ts`, `components/rewards-list.tsx`, `booking-facts.tsx`, `nav.ts`, `lib/my-bookings-links.ts`, `lib/customer-cant-come.ts` |
| Public page | `features/business-page/components/business-rewards.tsx` |
| Shared part | `components/reward-line.tsx` (the rule as one sentence; used by owner, customer, public page, admin) |
| Bells | `types/in-app-notifications.ts`, `lib/in-app-notifications.ts`, `features/notifications/` |
| Team area | `features/team-area/api/queries.ts`, `components/my-bookings.tsx` |
| Admin | `app/(admin)/admin/rewards/page.tsx`, `features/admin/api/rewards.ts`, `features/admin/components/rewards-list.tsx`, `admin-shell.tsx`, `bookings-list.tsx` |
| Assistant | `app/api/assistant/tools.ts`, `features/assistant/i18n/server-en.ts` |
| ESLint | No new feature folder, so no new zone: the shared code is in `lib/`, the screens in the features that own them. |

## Not in this plan

- Points with a name of their own, tiers (silver, gold), referral or birthday rewards, rewards for a review.
- Discount codes typed by the customer, gift cards, packages ("buy 10 up front").
- Free extras or products as a reward; more than one reward on a booking.
- WhatsApp or email messages about rewards (RW18).
- A reward card in Apple Wallet or Google Wallet.
- Counting visits made before the rule was turned on (see "Needs the owner").

## Risks

- **A changed phone number.** Visits follow `customer_key`. A customer who books with a new number starts a new count. The owner fixes it with "Add visits" (RW8). Joining two customers into one is not built anywhere in the app yet.
- **Money promised.** An earned reward is a promise from the business. Turning a rule off does not take rewards back (RW15); the editor says so in its one helper line.
- **Counting by time.** If the timer is down, visits are counted late, never lost: it catches up from `rewards_counted_at`. Same pattern and same server as the payment proof timer.
- **Price shown in many places.** The booking's price appears on the booking page, both booking details, the team area, the admin, the assistant and WhatsApp. RW9 keeps them right by not changing what `priceMinor` means; RW-6 has a test per place that shows a "before" price.
- **Size.** Sixteen tasks, the largest feature since WhatsApp. RW-1 to RW-6 are useful alone (earn and redeem work); the rest can follow in any order.

## Needs the owner

1. **Go**, or changes to the decisions above.
2. **RW7: redeeming online needs signing in with a phone code.** Safer, one more step for the customer. The other way (any typed phone redeems) is not safe; said here so it is a choice made knowingly.
3. **RW4 and RW6: a visit counts once the booking's time has passed**, unless marked no-show or cancelled; "only paid bookings" is a switch per rule, off at first.
4. **Old visits.** When a business turns on its first rule, do visits from before count? Plan says no: everyone starts at 0 on the day it is turned on, and the owner can add visits by hand for regulars. Counting back is possible but hands out rewards the business never planned for.
5. **RW19: Free or Pro.** Plan says Free for now, movable in Admin → Plans.
6. Nothing on wording (owner's rule, Nov 10): "Rewards", "Earn", "Redeem", "visits".

### Checked (Nov 10)

- Tests: rules (22), counting (19), the owner's buttons (3), the owner's actions (7), redeeming when booking (8), the reward on the booking screens (4). The related suites pass (lib, dashboard, booking, customer account, admin).
- Type check and lint: 0 errors outside `video/`.
- Browser, demo business, phone (375 and 320), light and dark: the Rewards page empty, the editor with More options, a rule saved and listed with its switch; the booking's details step with "Sign in to see your rewards". No sideways scroll.

### Not checked

- **The redeem switch in a browser.** It needs an account signed in with a phone code and an earned reward. Covered by tests; the screen itself was not seen.
- **The build.** Another session's dev server runs in this folder; `npm run build` was not run beside it.
- Spanish, Portuguese and French: the new words are translated at the next server start.

## Next step

RW-7 (the customer sees rewards after booking and in their account), then RW-8 (the owner's view per customer and redeeming for a customer).
