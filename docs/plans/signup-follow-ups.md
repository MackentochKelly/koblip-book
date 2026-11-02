# Sign-up follow-ups

Three problems found while doing [Sign-up fixes](signup-fixes.md)
(2026-11-01), none fixed there. How to use this file: [Plans](README.md).

## Rules for every task

- Read the official docs first (Next.js self-hosting, PM2, better-auth).
  Never guess an API or option.
- Every task adds or updates tests where code changes. All of typecheck,
  lint, test and build must pass.
- Production config changes are deployed only on the owner's go-ahead.

## Tasks

| Task | What | Size | Needs | Status |
| --- | --- | --- | --- | --- |
| F1 | The Spanish settings count matches what Translate does | S | | Done |
| F2 | A deploy lets running setup work finish | S | | To do |
| F3 | Sign-in works on every address the app runs on | S | | To do |

---

### F1 · The Spanish settings count matches what Translate does 🟠

**Problem:** Settings → Spanish counts the texts left to translate from
its own copy of the queries (`getTranslationStatus`). That copy reads team
members' job title but not their About, while the Translate run
(`translateBusinessTexts`) sends both. The count shows fewer texts than
Translate does, and a missing team About never shows as pending.

**Root cause:** the same six queries are written twice and have drifted.

**Fix:** one shared server function loads a business's translatable rows
and existing Spanish rows; both the status query and the Translate run
use it, so they can't drift again. No change to what gets translated.

**Files:** `features/dashboard/api/translation-queries.ts`,
`features/dashboard/api/translate-business.ts`, a new shared loader in
`features/dashboard/api/`, their tests.

**Done when:** a team member's About counts as pending until translated;
a test proves the status and the Translate run collect the same texts.

**Done (2026-11-02):** status and Translate use one read-only loader,
including team About and full saved translation rows. Tests cover About
becoming pending again, every text kind matching the AI request, and
orphan cleanup staying in Translate only.

### F2 · A deploy lets running setup work finish 🟠

**Problem:** `pm2 restart koblip-book` sends SIGINT, then SIGKILL after
1.6 s by default (pm2.keymetrics.io/docs/usage/signals-clean-restart).
Next.js finishes in-flight requests and pending `after()` callbacks on
SIGINT/SIGTERM and recommends a 10–30 s drain
(`node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`, `after`).
So a deploy kills setup work (catalog, team photos, Spanish) mid-way.
Since S9 setup resumes on the next visit, but the work starts over and
costs AI calls twice.

**Fix:** keep the PM2 setup in the repo as an ecosystem file
(`ecosystem.config.cjs`) with `kill_timeout: 30000`, the top of Next.js'
recommended range, and start Book from it on the server. Update the
deploy steps to use it. Confirm in the PM2 docs whether `reload` or
`restart` is right for a single instance.

**Files:** `ecosystem.config.cjs` (new), the deploy notes in `docs/`.

**Done when:** a deploy waits for running setup work (up to 30 s) before
the old server stops; checked once on the server with the owner's
go-ahead.

### F3 · Sign-in works on every address the app runs on 🟡

**Problem:** the sign-up audit got `403 INVALID_ORIGIN` from better-auth.
By default better-auth trusts only its base URL
(better-auth.com/docs/reference/security); `.env.local` sets
`BETTER_AUTH_URL=http://localhost:3100`, so a dev server on another port
(the worktree lanes use 3101) or another host (`127.0.0.1`) is refused.
Since S3 the form shows a clear error, but sign-in still fails there.

**Fix:** reproduce it first and confirm the refused origin. Then trust
the project's own dev origins with better-auth's documented
`trustedOrigins`, in development only. Production keeps trusting only
its own URL (the docs warn against localhost there).

**Files:** `lib/auth.ts`, its env docs, a test for the origin list.

**Done when:** sign-up works on each dev address the project uses, and
the production list holds only the production URL.

## Decisions log

| What | Why | Who | Date |
| --- | --- | --- | --- |
| F2: 30 s PM2 kill timeout, kept in a repo ecosystem file | The top of Next.js' recommended 10–30 s drain; in the repo it is reviewed and can't drift from what's on the server. Longer AI work still resumes through S9. | M Kelly B | 2026-11-01 |
