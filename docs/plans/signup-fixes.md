# Sign-up fixes

Ten fixes from the sign-up audit (2026-11-01): home search → pick business →
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
| S1 | Search by kind and town finds businesses | M | | Done |
| S2 | Search shows businesses, not street addresses | S | S1 | Working on: M Kelly B, 2026-11-01 |
| S3 | Sign-up errors say what went wrong, in the right place | S | | To do |
| S4 | "Getting your page ready" never looks stuck | M | | Done |
| S5 | Check details says Continue | S | | To do |
| S6 | Live screen has one "View page" | S | | To do |
| S7 | Live screen shows a useful category | S | | To do |
| S8 | Search box hint fits at 375px | S | | To do |
| S9 | Setup still finishes after a server restart | M | | Done |
| S10 | Keyboard focus stays in the list after a suggested search | S | S1 | Done |

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

**Done (2026-11-01, 514f568):** Autocomplete only matches names and
addresses, so the search now also asks Google for suggested searches
(`includeQueryPredictions`). They show as rows with a search icon
("photography studio near Brockton, MA, USA"); tapping one runs Text
Search (New) (`features/onboarding/api/places-text-search.ts`) and lists
the businesses. Text Search is billed only on a tap.

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

**Done (2026-11-01):** Muse starts the catalog, policies, team photos and
Spanish on the server when the Google details screen opens
(`features/starter-catalog/api/prepare-jobs.ts`); the preparing screen
joins that work instead of starting it.

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

### S8 · Search box hint fits at 375px 🟡

**Problem:** in the full-screen search panel at 375px the hint is cut off
("Search your busi…").

**Fix:** make the whole hint fit in English and Spanish: a shorter hint or
the input's layout, as the UI rules call for. Not a smaller font.

**Files:** `features/onboarding/i18n.ts`,
`features/onboarding/components/search-area.tsx`.

**Done when:** the whole hint shows at 375px in both languages.

### S9 · Setup still finishes after a server restart 🟠

**Problem:** since S4 the setup jobs live in the server's memory. If the
server restarts between the Google details screen and "Getting your page
ready", that screen skips its rows and goes straight to "You're live".
Team photos or Spanish not yet made are never made.

**Fix:** when the preparing screen finds no job, check what is saved for
the business and start whatever is missing, so the rows run as before.

**Files:** `features/starter-catalog/api/prepare-jobs.ts`,
`features/starter-catalog/api/prepare-actions.ts`,
`features/starter-catalog/components/preparing-card.tsx`.

**Done when:** with the job store emptied mid-setup, the rows still run
and the team photos and Spanish are made; a test covers it.

**Done (2026-11-01):** Setup uses the saved `setupFinishedAt` value,
so a lost job resumes the rows, missing team photos and Spanish without
replacing services or team. An owner-checked action finishes setup, also
when AI is off or the catalog fails. Finished businesses skip the work.

### S10 · Keyboard focus stays in the list after a suggested search 🟡

**Problem:** tapping a suggested search ("photography studio near
Brockton, MA, USA") replaces the list with businesses. The tapped row is
gone, so keyboard focus drops to the page and keyboard and screen reader
users lose their place.

**Fix:** when the businesses arrive, move focus to the first business
(React's `flushSync`, then focus), only when focus was in the list or
had dropped to the page.

**Files:** `features/onboarding/components/get-started.tsx`,
`features/onboarding/components/suggestion-list.tsx`.

**Done when:** after a suggested search, Tab and Enter carry on from the
first business; a test covers it.

**Done (2026-11-01):** when a suggested search's businesses arrive, focus
moves to the first one (React `flushSync`, then focus), unless the owner
moved focus to another control meanwhile. `get-started.test.tsx` covers
both cases.

## Decisions log

| What | Why | Who | Date |
| --- | --- | --- | --- |
| S9: setup state is saved on the business (`setupFinishedAt`), not kept in server memory | A restart or the 15-minute job expiry lost what was left to do; a saved column is the smallest safe fix. A saved jobs queue with a worker was left for later (more parts, risk of paying twice for AI calls) | M Kelly B | 2026-11-01 |
| S9: backfill demo copies and owned businesses with at least one service or team member with the migration time; all others stay null | Finished listings skip setup; unclaimed imports and owned listings without services or team can still prepare their catalog. Ownership claims keep the saved finish time. | M Kelly B | 2026-11-01 |
