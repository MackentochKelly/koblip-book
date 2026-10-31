# Member working hours — 2026-10-31

Implemented locally; no commit, push, or deployment. Release checks are blocked by unchanged files listed below.

## Built

- Generated `team_member_hours` with business/member cascade references, timestamps, and the member/weekday index using `npm run db:generate`.
- Members with no custom rows inherit business hours. Custom rows intersect with business hours. Overnight expansion remains in `openStretches`/`dayOpenStretches`.
- Public availability and booking rechecks use service-qualified members' effective schedules. Automatic assignment only considers members working for the entire appointment.
- Owner add/move checks the selected member's effective hours and returns a closed conflict when outside them. Existing explicit owner `allowConflict` overrides remain available for a selected member; automatic assignment never selects an off-duty member, including when overriding a conflict.
- The member form defaults to “Same as business hours”. Turning it off opens the shared weekly editor also used by Settings → Hours. Name and schedule are validated before an atomic batch save, with owner/business/member authorization.
- English and Spanish labels, theme tokens, mobile input sizes, and shared shadcn parts.
- Admin business entries include every team member and every stored custom hours row. Removed the business-list cap so older businesses' schedules remain reachable. Demo businesses retain their existing exclusion from admin listings.
- Demo copies map sample member-hour rows onto new member IDs. Demo cleanup, unclaimed-import cleanup, and member removal explicitly delete member hours without depending on enabled cascades.
- Assistant `list_team` returns each member's custom hours. Its free-time and booking tools already delegate to the updated booking APIs.

## Checked

- Browser: member form at 375×812 and 1280×800 in English and Spanish, light and dark. Additional 320px and 1920px checks. Document width equals viewport width at all four sizes. Mobile time inputs measured 16px text and 44px height. Checked inherited/custom toggle, weekly controls, keyboard dismissal, and focus return. Restored English/light and removed the temporary viewport override. No business member schedules were changed in the browser.
- Tests cover inheritance, custom ranges, clipping wider hours, selected member, different weekdays, overnight spill, unassigned-booking capacity, automatic assignment (including forced owner booking), owner add/move rejection, authorization, invalid inputs, atomic member creation/save, admin records, demo copy/purge, unclaimed cleanup, and explicit member-hours removal.
- Changed TypeScript/TSX files pass ESLint.
- Isolated current checkout: `npm test -- --exclude ".claude/**"` passes 725 tests, with 26 skipped (110 passed test files, one skipped).
- `npm run typecheck`: blocked by unchanged navigation errors, listed below. No errors reported in changed files.
- `npm run build`: compiled successfully; fails at TypeScript on the same unchanged navigation errors.
- Root-checkout lint, using `npm run lint -- --ignore-pattern '.claude/**'`: one unchanged error and one unchanged warning, listed below.
- `npm test`: 3,509 passed, 130 skipped across this checkout and the four nested checkouts (531 passed test files, five skipped). `npm run lint` fails: 7,733 errors and 159,986 warnings, mostly from nested checkouts and their generated `.next` files. The isolated root lint result above identifies the current checkout's one error and one warning.
- `git diff --check` passes.

## Fixes made while implementing

- Prevented automatic assignment from falling back to the first off-duty team member during an owner conflict override. Updated its existing regression test accordingly.
- Saved the member name and hours in a single batch, avoiding partial saves or duplicate retries when creating a person.
- Reused shared hours validation and the existing editor instead of creating a second editor. The extracted editor's add/remove controls explicitly use `type="button"` so they cannot submit the surrounding member form.
- Added explicit schedule cleanup for member deletion because the existing cleanup code documents that cascades cannot be relied on.
- Updated the assistant's mocked owner-business result to carry the new schedule data.

## Unrelated issues and limits

- `features/dashboard/navigation.ts:49`: TypeScript cannot infer the mixed readonly item arrays in `flatMap`; follow-on errors at lines 52–55 and `features/dashboard/components/top-bar.tsx:43`. These files match HEAD and were left alone as requested.
- `features/dashboard/components/bookings-view.tsx:118`: ESLint reports `react-hooks/purity` for `Date.now()` in the existing `open` handler. The handler was left unchanged; this report records the diagnostic without claiming that the handler executes during render.
- `app/layout.tsx:3`: existing unused `Geist` warning, unchanged.
- Concurrent edits appeared during this task in `components/floating-action-button.tsx:6` and `features/dashboard/components/bookings-view.tsx:327` (three floating-button looks). They are not this task's changes and were preserved. The affected files are excluded from the task file list below.
- Full lint also scans generated nested files, for example `.claude/worktrees/dev3-lane3/.next/build/chunks/[turbopack]_runtime.js:58` (`no-assign-module-variable`), plus unrelated nested source such as `.claude/worktrees/lane-4-business-page/hooks/use-mobile.ts:14` (`react-hooks/set-state-in-effect`). These other checkouts/generated files were not edited.
- `.claude/worktrees/` contains four other checkouts. The unqualified test/lint commands discover their sources/tests too. They were left untouched; isolated root-checkout checks exclude `.claude/**` only through CLI flags, without changing configuration.
- A custom schedule needs at least one row. An empty custom week would mean inheritance under the requested database rule, so the form/action reject it and display a localized error.
- Browser checks used Chrome responsive viewports, not a physical iPhone. Contrast uses the existing theme tokens; no independent contrast audit of unchanged shared controls was performed.

## Reviewed without changes

- Public availability route: delegates to `getAvailability`; request/response shape unchanged.
- Assistant system prompt: no claim that every member shares business hours; booking/free-time tools already use the updated APIs.
- Team/service link queries and writes: qualification rules are unchanged and applied before schedule filtering.
- Public business page: displays business opening hours, not individual member schedules; availability is fetched separately.
- Place import and onboarding preparation: create/read business hours; they do not create team members or custom member schedules.
- Re-ran and reviewed every hit of `rg -n "businessHours|teamMemberServices|availability\(|dayOpenStretches\(" app features lib`. Relevant booking reads, owner queries, cleanup paths, and tests are covered above.

## Local database

Applied migration `0027_puzzling_korvac.sql` only to `data/koblip-book.db` after making a consistent SQLite backup:
`/var/folders/_l/z0m8ylb93gxcdkc73s_klb1h0000gn/T/koblip-member-hours-backup-gposkyky/koblip-book.db`.

Production was not touched.

## Every repository file changed/added by this task (36 files)

- [app/(owner)/dashboard/[businessId]/team/page.tsx](</Volumes/128 GBMax/Dev/koblip-book/app/(owner)/dashboard/[businessId]/team/page.tsx>)
- [app/api/assistant/tools.test.ts](</Volumes/128 GBMax/Dev/koblip-book/app/api/assistant/tools.test.ts>)
- [app/api/assistant/tools.ts](</Volumes/128 GBMax/Dev/koblip-book/app/api/assistant/tools.ts>)
- [components/weekly-hours-editor.tsx](</Volumes/128 GBMax/Dev/koblip-book/components/weekly-hours-editor.tsx>)
- [docs/member-hours-report-2026-10-31.md](</Volumes/128 GBMax/Dev/koblip-book/docs/member-hours-report-2026-10-31.md>)
- [drizzle/0027_puzzling_korvac.sql](</Volumes/128 GBMax/Dev/koblip-book/drizzle/0027_puzzling_korvac.sql>)
- [drizzle/meta/0027_snapshot.json](</Volumes/128 GBMax/Dev/koblip-book/drizzle/meta/0027_snapshot.json>)
- [drizzle/meta/_journal.json](</Volumes/128 GBMax/Dev/koblip-book/drizzle/meta/_journal.json>)
- [features/admin/api/member-hours.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/admin/api/member-hours.test.ts>)
- [features/admin/api/queries.ts](</Volumes/128 GBMax/Dev/koblip-book/features/admin/api/queries.ts>)
- [features/admin/components/businesses-list.tsx](</Volumes/128 GBMax/Dev/koblip-book/features/admin/components/businesses-list.tsx>)
- [features/admin/i18n/index.ts](</Volumes/128 GBMax/Dev/koblip-book/features/admin/i18n/index.ts>)
- [features/booking/api/create-booking.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/api/create-booking.ts>)
- [features/booking/api/create-owner-booking.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/api/create-owner-booking.test.ts>)
- [features/booking/api/create-owner-booking.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/api/create-owner-booking.ts>)
- [features/booking/api/get-availability.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/api/get-availability.ts>)
- [features/booking/api/member-hours.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/api/member-hours.test.ts>)
- [features/booking/api/move-owner-booking.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/api/move-owner-booking.ts>)
- [features/booking/utils/availability.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/utils/availability.test.ts>)
- [features/booking/utils/availability.ts](</Volumes/128 GBMax/Dev/koblip-book/features/booking/utils/availability.ts>)
- [features/dashboard/api/actions.ts](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/api/actions.ts>)
- [features/dashboard/api/member-hours.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/api/member-hours.test.ts>)
- [features/dashboard/api/member-hours.ts](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/api/member-hours.ts>)
- [features/dashboard/api/queries.ts](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/api/queries.ts>)
- [features/dashboard/components/hours-form.tsx](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/components/hours-form.tsx>)
- [features/dashboard/components/team-view.tsx](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/components/team-view.tsx>)
- [features/dashboard/i18n/en/catalog.ts](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/i18n/en/catalog.ts>)
- [features/dashboard/i18n/es/catalog.ts](</Volumes/128 GBMax/Dev/koblip-book/features/dashboard/i18n/es/catalog.ts>)
- [features/demo/api/demo-copy.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/demo/api/demo-copy.test.ts>)
- [features/demo/api/demo-copy.ts](</Volumes/128 GBMax/Dev/koblip-book/features/demo/api/demo-copy.ts>)
- [features/demo/api/purge-demos.ts](</Volumes/128 GBMax/Dev/koblip-book/features/demo/api/purge-demos.ts>)
- [features/demo/sample.ts](</Volumes/128 GBMax/Dev/koblip-book/features/demo/sample.ts>)
- [features/onboarding/api/purge-unclaimed.test.ts](</Volumes/128 GBMax/Dev/koblip-book/features/onboarding/api/purge-unclaimed.test.ts>)
- [features/onboarding/api/purge-unclaimed.ts](</Volumes/128 GBMax/Dev/koblip-book/features/onboarding/api/purge-unclaimed.ts>)
- [lib/db/schema.ts](</Volumes/128 GBMax/Dev/koblip-book/lib/db/schema.ts>)
- [lib/hours-rules.ts](</Volumes/128 GBMax/Dev/koblip-book/lib/hours-rules.ts>)

## Browser evidence

![Member working-hours editor](/Users/mkellyb/.codex/visualizations/2026/10/31/01a1904a-e188-7060-8eb2-4df840a5a1eb/member-hours-desktop.png)
