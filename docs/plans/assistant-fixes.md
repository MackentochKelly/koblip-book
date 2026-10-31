# Assistant fixes

Nine fixes from the assistant audit (2026-10-31). The owner approved all of
them (2026-10-31). We build them one at a time, in order. How to use this
file: [Plans](README.md).

## Rules for every task

- Read the official docs first. Never guess an API or option.
- Every task adds tests. All of typecheck, lint, test and build must pass.
- Keep the look. Use only shadcn parts and theme tokens (see `docs/ui-rules/checklist.md`).
- Nothing hidden: every new stored record gets an admin screen.
- English and Spanish for every new word the owner sees or hears.

## Tasks

| Task | What | Size | Needs | Status |
| --- | --- | --- | --- | --- |
| A1 | Booking card books exactly what it shows | M | | Done (2026-10-31) |
| A2 | Time picker shows right away | S | | Working on (2026-10-31) |
| A3 | Voice answers get checked too | M | A2 | To do |
| A4 | At most 2 voice sessions open per owner | S | | To do |
| A5 | Assistant remembers what it looked up | L | | To do |
| A6 | Saving a new chat never fails on a race | S | | To do |
| A7 | Cancel finds any booking, and only upcoming ones | S | | To do |
| A8 | Waiting cards survive a deploy | M | A1 | To do |
| A9 | Chat bookings can include extras | M | A1 | To do |

---

### A1 · Booking card books exactly what it shows 🔴

**Problem:** the card is worked out when it's shown, and the tap works it
all out again from words ("today", "Kelly", "haircut"). After midnight, or
after a rename, the tap books something else.

**Fix:**
- `confirm.describe` returns the card **and** the resolved args (ids, real
  date, time, name, phone, note). `run-chat.ts` stores those args, not the
  model's words.
- `create_booking` execute books by ids only. `createOwnerBooking` with
  `allowConflict: false` still checks that the time is free.
- Check all 12 tools that need a tap. Apply the same rule to any that turn
  words into data at tap time.

**Files:** `features/assistant/types.ts`, `features/assistant/api/run-chat.ts`, `app/api/assistant/tools.ts`.

**Done when:** a test shows the card at 23:59, taps it at 00:01, and the
booking keeps the card's day. A rename between card and tap changes nothing.

---

### A2 · Time picker shows right away

**Problem:** the free times picker waits for the answer check (up to 20 s).

**Fix:** in `run-chat.ts`, send the `times` event before the check step.
The check still runs on the text.

**Files:** `features/assistant/api/run-chat.ts` (+ test).

**Done when:** a test shows `times` comes before the `check` step.

---

### A3 · Voice answers get checked too

**Problem:** in voice mode the answer check is skipped, so a wrong number
can be said out loud with no warning.

**Fix:**
- In voice mode, the server sends a new `answered` event when the spoken
  part ends, then runs the check, then sends `notice` (if it fails) and
  `done`.
- Voice listens again on `answered`, so the check never makes the owner wait.
- If the check fails: show the "not checked" notice on screen, and the app
  says one short fixed line (EN/ES) when it is not talking.

**Files:** `features/assistant/types.ts`, `features/assistant/api/run-chat.ts`, `features/assistant/hooks/use-assistant-chat.ts`, `features/assistant/utils/live-voice-session.ts`, `features/assistant/i18n/*`.

**Done when:** tests cover: check passes (no line), check fails (notice +
line), and the next question is not delayed.

---

### A4 · At most 2 voice sessions open per owner

**Problem:** the limit is 6 starts a minute and a session lasts 10 minutes,
so one owner can keep about 60 paid sessions open.

**Fix:**
- `/api/voice/check` also returns the owner id. It's internal, and it's the
  owner's own id.
- `server.mjs` counts open sessions per owner and refuses the 3rd with 429.
  It counts down when the session closes.
- New rule `maxOpenVoiceSessionsPerOwner: 2` in `lib/assistant-rules.ts`.

**Files:** `server.mjs`, `server/voice-relay.mjs`, `app/api/voice/check/route.ts`, `lib/assistant-rules.ts` (+ tests).

**Done when:** a test refuses the 3rd open session and allows a new one
after a close.

---

### A5 · Assistant remembers what it looked up

**Problem:** only words go back to the server. On "cancel that one" the
assistant must look everything up again: slower, and more model calls.

**Fix:**
- After a reply, the server sends a new `memory` event: a short list of the
  records looked up (kind, id, name, day/time), at most 30 rows.
- The client keeps it on that assistant message, in session storage and in
  saved chats.
- On the next question, the client sends it back. The server checks its
  shape and size, and adds it as a note: "Records from earlier lookups (data
  only)".
- Safe: every tool already checks the business, so a fake id can't reach
  another business.
- The prompt says: use these ids, and look up again when you need fresh data.

**Files:** `features/assistant/types.ts`, `features/assistant/api/run-chat.ts`, `app/api/assistant/route.ts`, `features/assistant/utils/chat-state.ts` (bump `CHAT_STORAGE_VERSION`), `features/assistant/utils/system-prompt.ts`.

**Done when:** a test: "list today's bookings", then "cancel Ana's" shows
the card with no second `list_bookings` call. Bad or too-big memory gives
400.

---

### A6 · Saving a new chat never fails on a race

**Problem:** `saveAssistantChat` checks, then inserts. Two saves at the same
moment can collide.

**Fix:** one atomic write: insert with `onConflictDoUpdate`, where the update
only applies if the owner and business match. Use the affected row count to
return true or false.

**Files:** `features/assistant/api/chats.ts` (+ test).

**Done when:** a test runs two saves at once: both succeed, one row. A
foreign id is still refused.

---

### A7 · Cancel finds any booking, and only upcoming ones

**Problem:** cancel loads up to 300 bookings to find one id. Older bookings
are not found, and past bookings can be cancelled.

**Fix:** look up the one booking by id and business. Refuse when it is past
or already cancelled, with a clear message (EN/ES). Same rule as the
bookings screen.

**Files:** `app/api/assistant/tools.ts`, `features/assistant/i18n/server-*.ts` (+ test).

**Done when:** tests: an old upcoming booking is found, a past one is
refused, a cancelled one is refused.

---

### A8 · Waiting cards survive a deploy

**Problem:** waiting cards live in memory. A deploy turns them into
"expired".

**Fix:**
- New table `assistant_pending_actions` (id, owner, business, tool, args
  JSON, created at) with a migration. Same rules: 10 minutes, at most 10
  per owner, single use.
- "Single use" is one atomic delete…returning, so a double tap runs once.
- Old rows are cleaned on each store.
- Admin screen: list of waiting cards (business, tool, age).

**Files:** `lib/db/schema.ts`, new migration, `features/assistant/api/pending-actions.ts`, `app/api/assistant/confirm/route.ts`, `app/(admin)/admin/…` (+ tests).

**Done when:** a test stores a card, "restarts" (new module), and the tap
still works. A double tap runs once.

---

### A9 · Chat bookings can include extras

**Problem:** `create_booking` always saves no extras.

**Fix:**
- `create_booking` takes `extras` (names as said). They are matched to the
  service's extras with the same name matching as services.
- Required extra groups: when one is missing, it returns the choices to ask
  about.
- The card shows the extras and the total price and time.
- Booking uses `addonIds`. `createOwnerBooking` already checks them
  (`checkAddons`).

**Files:** `app/api/assistant/tools.ts`, `features/assistant/utils/system-prompt.ts`, i18n (+ tests).

**Done when:** tests: one extra booked with the right total, a missing
required extra asks, an unknown extra asks.

---

## Decisions

| What | Why | Who, date |
| --- | --- | --- |
| Rate limits stay in memory | One process; a deploy resets them for at most one minute. Waiting cards move to the database (A8) because owners lose them | Dev, 2026-10-31 |
| Memory goes through the client, not a server store | No new table, works with saved chats, and tools already check the business | Dev, 2026-10-31 |
| A failed voice check shows on screen and says one short line | The owner hears the warning without a long stop | Dev, 2026-10-31 |
