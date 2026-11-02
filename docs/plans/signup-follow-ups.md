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
| F2 | A deploy lets running setup work finish | S | | Working on: M Kelly B, 2026-11-02 |
| F3 | Sign-in works on every address the app runs on | S | | Working on: M Kelly B, 2026-11-02 |

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

**Root cause (audit, 2026-11-02):** a longer PM2 timeout alone changes
nothing. Book runs a custom `server.mjs`, and Next.js' signal handling
lives only in `next start` (`next/dist/server/lib/start-server.js`), so
`server.mjs` exits at once on SIGINT. PM2 also runs it through `npm start`,
which puts npm and a shell between PM2 and the server. Team photo jobs in
`startPreparing` are not awaited, so `after()` doesn't wait for them either.

**Fix:**
1. `server.mjs` shuts down the way `start-server.js` does: stop accepting
   requests, finish the ones running, then `app.close()`, which waits for
   `after()` work. Open voice sessions are closed first. A 28 s limit always
   ends the process before PM2's SIGKILL.
2. `startPreparing` awaits the team photos.
3. Keep the PM2 setup in the repo (`ecosystem.config.cjs`): runs
   `server.mjs` directly, `kill_timeout: 30000`. The release script starts
   the app from that file, so the file is what runs.

**Files:** `server.mjs`, `server/shutdown.mjs` (new) and its test,
`features/starter-catalog/api/prepare-jobs.ts`, `ecosystem.config.cjs`
(new), `scripts/deploy-release.sh`, `docs/deploy.md`.

**Done when:** a stop signal waits for running setup work (up to 28 s) and
then exits; tests cover it; checked once on the server with the owner's
go-ahead.

**Built (2026-11-02), server check still to do:** the custom server drains
requests and `after()` work, including team photos, with a 28 s limit.
PM2 runs the server directly with a 30 s timeout; release and rollback
read the checked-out configuration, with a fallback for older commits.

### F3 · Sign-in works on every address the app runs on 🟡

**Problem:** the sign-up audit got `403 INVALID_ORIGIN` from better-auth.
By default better-auth trusts only its base URL
(better-auth.com/docs/reference/security).

**Root cause (audit, 2026-11-02):** one dev server answers on two addresses.
Reproduced on `BETTER_AUTH_URL=http://localhost:3100`: a sign-in from
`localhost:3100` passes the check, the same one from `127.0.0.1:3100` gets
the 403. Production is not affected: nginx serves only book.koblip.com, its
`BETTER_AUTH_URL`. Worktrees are not affected either: each sets its own URL.

**Fix:** in development only, `proxy.ts` redirects a page opened on another
loopback name of the same port to the `BETTER_AUTH_URL` address, so the app
has one address. The auth settings don't change.

**Files:** `proxy.ts`, `lib/dev-address.ts` (new) and its test.

**Done when:** opening `127.0.0.1:<port>` lands on the `BETTER_AUTH_URL`
address and sign-up works there; a production build never redirects.

## Decisions log

| What | Why | Who | Date |
| --- | --- | --- | --- |
| F2: 30 s PM2 kill timeout, kept in a repo ecosystem file | The top of Next.js' recommended 10–30 s drain; in the repo it is reviewed and can't drift from what's on the server. Longer AI work still resumes through S9. | M Kelly B | 2026-11-01 |
| F2: keep one instance and `pm2 restart`; no cluster mode | PM2's code shows `reload` in fork mode is just a restart, so no zero-downtime that way. Cluster mode would split the in-memory setup jobs and voice session limits across processes. Trade-off: a deploy while long work runs can take the site down for up to 30 s; an idle server stops at once. | M Kelly B | 2026-11-02 |
| F3: one dev address through a dev-only redirect, not `trustedOrigins` | Trusting `127.0.0.1` would pass the email check but leave Google broken: its state cookie is set on `127.0.0.1` while Google returns to `BETTER_AUTH_URL`. Sessions and email links also stay tied to one address. The auth settings, which guard production, stay untouched. Other devices on the network stay refused, since nothing uses them. | M Kelly B | 2026-11-02 |
