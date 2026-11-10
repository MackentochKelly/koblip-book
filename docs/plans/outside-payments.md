# Pay outside the app: follow-ups

Paying outside the app (bank transfer, Zelle, pay later) is built, see [Nova theme](nova-theme.md) → "Legacy features". This plan is what is left so that payments show up everywhere a booking does: the bells, the assistant, the team area and the admin.

**Status (Nov 10):** OP-1 to OP-9 are built and tested on this Mac. **Not committed**, like the base feature. Nothing pushed or deployed. Left: the translation run, three browser checks that need real accounts (OP-10), and WhatsApp (OP-11, needs the owner).

## Rules that stay

- A payment is only **Paid** when the owner says so. No message, tool or screen below may set it any other way.
- Payment instructions are private: shown to the customer who booked, the owner and the app admin. Never on the public page, never to team members.
- A business with no ways to pay sees none of this.
- Same data and code in Luma and Nova. Tokens only.
- English words only; Spanish, Portuguese and French come from the translation run.

## What exists today

| Part | Today |
| --- | --- |
| Owner bell | 12 kinds (`types/in-app-notifications.ts`). None about payment. |
| Client bell | 5 kinds. None about payment. |
| WhatsApp | 8 booking messages, each a Meta template with fixed words and fields (`features/dashboard/utils/booking-templates.ts`). No payment field. |
| Assistant | 54 tools (`app/api/assistant/tools.ts`). `list_bookings` does not return payment. No payment tool. |
| Team area | A member sees their own bookings: service, time, customer, status. Cannot move or cancel ([team accounts](team-accounts.md)). |
| Admin | Bookings list: business, service, customer, status. No payment. No screen for `payment_methods`. |

## Decisions

- **OP1. Bells first, WhatsApp later.** The two moments that need a nudge are "the customer says they paid" (owner) and "the business confirmed it" (customer). Both go in the bells, which need no approval from Meta. Why not WhatsApp now: every booking message is a Meta template; a new field or message means a new review for every business in four languages, and the instructions can be long and private.
- **OP2. The confirmed message is not changed.** The customer already sees the instructions right after booking and on their booking page.
- **OP3. Team members see, don't mark.** Same line as team accounts: the owner keeps control. A member sees the way to pay (name only) and the status on their own bookings. Widen later if asked.
- **OP4. The assistant marks paid only through the confirm card**, like its other changes, and calls the same server code as the button (`setBookingPaid`). It never answers "paid" from the customer's claim.
- **OP5. Admin sees everything, changes nothing.** Payment on the bookings list, and a read-only list of each business's ways to pay.

## Tasks

In order. Each is small and ends with its own tests.

| ID | Task | What was built | Status |
| --- | --- | --- | --- |
| OP-1 | Owner bell: "says they paid" | Kind `customerPaid`, made in `reportPayment`. "{who} says they paid", opens Bookings. One notice per booking, new again if the customer reports a second time. On/off in Settings → Notifications. | Done |
| OP-2 | Client bell: "payment confirmed" | Kind `clientPaid`, saved together with the change in `setBookingPaid`, only when it turns paid. Opens the customer's booking page. | Done |
| OP-3 | Owner list: find what to check | "Review payment" tab with its count on Bookings, shown only when some booking tracks a payment. | Done |
| OP-4 | Assistant reads payments | `list_bookings` returns choice, way, status and reference, and takes a `payment` filter. New `list_payment_methods`. `business_overview` has `paymentsToCheck` when the business lists ways to pay. | Done |
| OP-5 | Assistant marks paid | `set_booking_paid` with the confirm card, through `setBookingPaid`. | Done |
| OP-6 | Assistant edits ways to pay | `save_payment_method`, `remove_payment_method`, `set_pay_at_visit`, each with the confirm card, through the existing actions. The result line opens Settings → Payments. | Done |
| OP-7 | Team area | Own bookings show the way's name (or "Pays at the visit") and a status badge. Read only. The query leaves out the instructions and the reference. | Done |
| OP-8 | Admin: bookings | Way and status on each row of Admin → Bookings. | Done |
| OP-9 | Admin: ways to pay | New screen Admin → Payments: each real business with a way to pay, its ways, "Pay at the visit" on or off, and how many payments wait. Read only. | Done |
| OP-10 | Leftovers | See "Not checked". | Open |
| OP-11 | WhatsApp | See "Needs the owner". | Needs the owner |

### Where the code is

| Part | Files |
| --- | --- |
| Bells | `types/in-app-notifications.ts`, `lib/in-app-notifications.ts`, `features/notifications/` (words, icons, choices), `features/admin/i18n/en.ts` (kind names) |
| Review payment tab | `features/dashboard/utils/booking-filters.ts`, `features/dashboard/components/bookings-table.tsx` |
| Assistant | `app/api/assistant/tools.ts`, `features/assistant/i18n/server-en.ts`, `features/dashboard/api/payment-queries.ts`; result link `payments` in `features/assistant/types.ts` and `message-list.tsx` |
| Shared badge | `components/payment-badge.tsx`, used by the owner area, the team area, the customer's booking page and the admin |
| Team area | `features/team-area/api/queries.ts`, `types.ts`, `components/my-bookings.tsx` |
| Admin | `features/admin/api/payments.ts`, `features/admin/components/business-payments-list.tsx`, `app/(admin)/admin/payments/page.tsx`, `features/admin/api/queries.ts`, `bookings-list.tsx`; new `BankIcon` in `components/ui/icons.tsx` |

### Checked (Nov 10)

- Tests: whole suite, 2064 pass. New: bells (4), Review payment filter (1), assistant payment tools (11, among 250 assistant tests), team area with a no-leak test (2), admin (2). The only failing files are the 27 tool tests in `video/`, as before.
- Type check and lint: 0 errors outside `video/`. Build: compiles, stops at the type check on `video/`, as before.
- Browser (demo business, local database): the "Review payment" tab at computer width and 375px with no sideways scroll; the assistant answered what waits and which ways exist, showed the "Mark as paid?" card, and the tap marked the booking paid in the database.

### Not checked

- **The bells in a browser.** Demo businesses get no notifications by design, so both need a real business and a real customer account. Covered by tests.
- **Team area and admin screens in a browser.** They need a team account and an admin account. Covered by tests; the screens themselves were not seen.
- **The customer's "I've paid" block** (from the base feature): still not seen in a browser, same reason.
### Translations (Nov 10, owner's go)

- New words go to Google by themselves when the server starts ([translations](translations.md), G6). Done on this Mac: `npm run i18n:check` gives 0 errors, every new word has Spanish, French and Portuguese.
- Google misread some English, so the English was changed, not the translations, which fixes every language and the live site too:
  - "Check payment" became "pay by cheque" in Spanish and French → now **"Review payment"** (tab and badge).
  - "Not paid" became "is not paid for" in Spanish, and "Unpaid" became "unsalaried" in French and Portuguese → now **"Payment pending"** (owner, team and admin badge).
  - The assistant's "Save" became "save money" → "Save changes"; its step lines reworded the same way.
  - Admin: "Pay at the visit: on / off" → "Pay at the visit is on / off"; "payments to check" → "payments to review".
- Seen in Spanish at 375px, no sideways scroll: Bookings, Settings → Payments, Settings → Theme.
- The translations are in this Mac's database. The live site makes its own at its first start after a deploy.
- Still odd, not changed: Nova's "Preview" button reads "Avance" in Spanish (should be "Vista previa"). Fix it in Admin → Translations, or reword the English.

### Notes per task

- **OP-1, OP-2.** Add the kinds to `OWNER_IN_APP_KINDS` / `CLIENT_IN_APP_KINDS`, the words to `features/notifications/i18n/en.ts`, the link in `inAppLink`. No new table: the bell stores kind and facts. `features/customer-account` and `features/dashboard` already call `lib/in-app-notifications.ts`, so no feature imports another.
- **OP-3.** A filter over data the list already has (`OwnerBooking.payment`). No query change.
- **OP-4 to OP-6.** The shared rules are in `lib/payment-rules.ts`; the assistant route may use the dashboard's actions as it does for bookings. Tool descriptions say plainly: a customer saying they paid is "to check", not paid. Tests in `app/api/assistant/tools.test.ts`, including another business's booking being refused.
- **OP-7.** Add `payment` to `MyBooking` in `features/team-area/types.ts` with the method's name and status only; the query leaves out `details` and the reference. The status badge moves from `features/dashboard/components/` to `components/` so both areas use the one part.
- **OP-8, OP-9.** Behind `requireAdmin()`, real businesses only, as the other admin lists.

### Not in this plan

- Taking money in the app (cards, Stripe for bookings).
- Deposits, part payments, refunds, receipts.
- Reports of money received.

## Needs the owner

- **Commit.** Neither the base feature nor OP-1 to OP-9 is committed.
- **OP-11, WhatsApp.** Two ways, both mean new wording sent to Meta for review, per business, in four languages:
  1. A new message, "How to pay", sent after a booking made with bank transfer or Zelle.
  2. A new owner alert, "says they paid", beside the three owner alerts.
  Neither is needed for the feature to work. Say which, if any, and approve the exact words before anything is submitted.
- **Wording.** The tab and badge "Review payment" and the badge "Payment pending" (both reworded so Google translates them right); the bells "{who} says they paid" and "Payment confirmed: {service}, {when}"; the team area's "Being checked" and "Pays at the visit".
- **Team members marking payments (OP3).** Stay read-only, or let them mark their own bookings paid?

## Next step

1. Owner: say whether to commit (base feature and this plan's work together).
3. With a real business, customer, team and admin account: the four browser checks above.
4. OP-11 if the owner wants WhatsApp.
