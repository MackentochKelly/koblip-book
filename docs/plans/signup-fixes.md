# Sign-up fixes

Seven fixes from the sign-up audit (2026-11-01): home search → pick business →
create account → Google details → check details → getting ready → live,
checked at 375px and 1280px. Every step works today; these make it clearer
and faster. How to use this file: [Plans](README.md).

## Rules for every task

- Read the official docs first (Google Places API (New), better-auth,
  Next.js). Never guess an API or option.
- Every task adds or updates tests. All of typecheck, lint, test and build
  must pass.
- Keep the look. Use only shadcn parts and theme tokens (see
  `docs/ui-rules/checklist.md`). Check 375px and desktop, light and dark.
- English and Spanish for every new word the owner sees.

## Tasks

| Task | What | Size | Needs | Status |
| --- | --- | --- | --- | --- |
| S1 | Search by kind and town finds businesses | M | | To do |
| S2 | Search shows businesses, not street addresses | S | S1 | To do |
| S3 | Sign-up errors say what went wrong, in the right place | S | | To do |
| S4 | "Getting your page ready" never looks stuck | M | | To do |
| S5 | Check details says Continue | S | | To do |
| S6 | Live screen has one "View page" | S | | To do |
| S7 | Live screen shows a useful category | S | | To do |

---

### S1 · Search by kind and town finds businesses 🔴

**Problem:** "photography studio Brockton" shows "No business found". Only a
business's own name works, but many owners type what they are and where.

**Fix:** read the Places API (New) docs for Autocomplete and Text Search.
Find why a kind-plus-town query returns nothing (the request's filters, or
the server action aborting: the browser showed the POST as
`net::ERR_ABORTED`), and make these queries return nearby businesses.

**Files:** `features/onboarding/api/places-autocomplete.ts`,
`features/onboarding/api/search-actions.ts`,
`features/onboarding/components/search-area.tsx`.

**Done when:** "photography studio Brockton" lists photo studios in
Brockton; a test covers the request it sends.

### S2 · Search shows businesses, not street addresses 🟠

**Problem:** "Studio 7 Photography Boston" lists 7 Rue de Boston, 7 North
Street, 7 VFW Parkway… Addresses can't become a booking page.

**Fix:** limit the suggestions to business places with the documented
type filter (e.g. `includedPrimaryTypes` set to `establishment`), not by
filtering text afterwards.

**Files:** `features/onboarding/api/places-autocomplete.ts`,
`features/onboarding/components/suggestion-list.tsx`.

**Done when:** no plain street or route shows in the list; a test covers
the filter.

### S3 · Sign-up errors say what went wrong, in the right place 🟠

**Problem:** any failed sign-up says "That did not work. Please try again."
under the password field and marks it red, even when the password is fine
(seen with a 403 from the auth origin check).

**Fix:** map better-auth's documented error codes (email already used,
weak password, too many tries, other) to short messages. Show password
errors on the password field, the rest as a form error.

**Files:** `features/owner-auth/components/auth-form.tsx`,
`features/owner-auth/i18n.ts`,
`features/owner-auth/components/auth-form.test.tsx`.

**Done when:** each case shows its own message on the right field; tests
cover each one.

### S4 · "Getting your page ready" never looks stuck 🟡

**Problem:** the Services row spins alone for about 20 seconds before
anything else moves; the whole step takes about 70 seconds.

**Fix:** start the rows that don't need the services (policies, team) at
the same time, so several rows move at once. Show a short, calm hint that
it takes about a minute.

**Files:** `features/starter-catalog/components/preparing-card.tsx`,
`features/starter-catalog/api/prepare-actions.ts`.

**Done when:** within 5 seconds more than one row is moving; the end
result is the same as today.

### S5 · Check details says Continue 🟡

**Problem:** the setup step's button says "Save", like a settings page.
In a step-by-step setup the next step is expected.

**Fix:** label it "Continue" on the setup page only; Settings keeps "Save".

**Files:** `app/(owner)/setup/[businessId]/page.tsx`,
`features/dashboard/components/details-form.tsx` (a label prop, not a copy).

**Done when:** setup shows Continue, Settings shows Save.

### S6 · Live screen has one "View page" 🟡

**Problem:** "View page" in the top bar and "View my page" on the card do
the same thing. One main action per screen.

**Fix:** hide the top bar's View page on the setup screens.

**Files:** `app/(owner)/setup/[businessId]/ready/page.tsx`,
`features/dashboard/components/top-bar.tsx`.

**Done when:** the live screen shows one View page, on the card.

### S7 · Live screen shows a useful category ⚪

**Problem:** "Boston Photo Studio · Services": Google's primary type for
that listing is just "Services".

**Fix:** when Google's category is generic, use a better one (from the
place's other types, or what Muse picked for the catalog). Decide the
rule and log it below.

**Files:** `features/place-import/utils/map-place.ts`,
`features/onboarding/components/live-card.tsx`.

**Done when:** that listing shows a photography category; a test covers
the generic case.

## Decisions log

| What | Why | Who | Date |
| --- | --- | --- | --- |
