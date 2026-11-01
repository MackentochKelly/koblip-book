# Assistant fixes

Fixes from the assistant audits (2026-10-31 and 2026-11-01). The owner approved all of
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
| A2 | Time picker shows right away | M | | Done (2026-10-31) |
| A3 | Voice answers get checked too | M | A2 | Done (2026-10-31) |
| A4 | At most 2 voice sessions open per owner | S | | Done (2026-10-31) |
| A5 | Assistant remembers what it looked up | L | | Done (2026-10-31) |
| A6 | Saving a new chat never fails on a race | S | | Done (2026-10-31) |
| A7 | Cancel finds any booking, and only upcoming ones | S | | Done (2026-10-31) |
| A8 | Waiting cards survive a deploy | M | A1 | Done (2026-10-31) |
| A9 | Chat bookings can include extras | M | A1 | Done (2026-10-31) |
| A10 | Times, days and prices read and sound normal | M | | Done (2026-10-31) |
| A11 | Money answers match the dashboard | M | | Done (2026-11-01) |
| A12 | A refused action shows as failed | S | | Done (2026-11-01) |
| A13 | Voice says one short line before lookups | S | | To do |
| A14 | A check that can't run says so | S | | To do |

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
The screen only shows the picker once the whole reply ends, so moving the
`times` event alone is not enough.

**Fix (owner's pick, 2026-10-31):** the check runs after the reply.
- The reply ends at once. The server stores the check (`answer-checks.ts`)
  and sends a `check` event.
- The screen then calls `POST /api/assistant/check`. Its outcome (chip,
  notice, buttons) goes to that reply, even if the owner already asked again.

**Files:** `features/assistant/api/answer-checks.ts`, `app/api/assistant/check/route.ts`, `features/assistant/api/run-chat.ts`, `features/assistant/types.ts`, `features/assistant/utils/chat-state.ts`, `features/assistant/utils/http-transport.ts`, `features/assistant/hooks/use-assistant-chat.ts` (+ tests).

**Done when:** the reply and picker come with no check call. The check
runs after, once, only for its owner.

---

### A3 · Voice answers get checked too

**Problem:** in voice mode the answer check is skipped, so a wrong number
can be said out loud with no warning.

**Fix:**
- Voice uses A2's check-after flow: the reply ends at once and sends
  `check`, and voice listens again right away.
- If the check fails: show the "not checked" notice on screen, and the app
  says one short fixed line (EN/ES) when it is not talking.

**Files:** `features/assistant/api/run-chat.ts`, `features/assistant/hooks/use-assistant-chat.ts`, `features/assistant/utils/live-voice-session.ts`, `features/assistant/i18n/*`.

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

**Files:** `server.mjs`, `server/voice-slots.mjs` (the counter), `app/api/voice/check/route.ts`, `lib/assistant-rules.ts` (+ tests).

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

**Files:** `features/assistant/utils/memory.ts` (rows and checks), `features/assistant/types.ts`, `features/assistant/api/run-chat.ts`, `app/api/assistant/route.ts`, `app/api/assistant/chats/[id]/route.ts`, `features/assistant/utils/chat-state.ts` (bump `CHAT_STORAGE_VERSION`), `features/assistant/utils/system-prompt.ts`, `lib/assistant-rules.ts`.

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

**Files:** `lib/db/schema.ts`, `drizzle/0035_assistant_pending_actions.sql`, `features/assistant/api/pending-actions.ts`, `app/api/assistant/confirm/route.ts`, `features/admin/api/assistant.ts`, `features/admin/components/admin-assistant.tsx`, `app/(admin)/admin/assistant/` (+ tests).

**Deploy:** run `npm run db:migrate` (new table).

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

**Files:** `app/api/assistant/tools.ts`, `features/assistant/utils/system-prompt.ts`, `features/assistant/i18n/server-*.ts` (+ tests). `find_free_times` takes the same `extras`, so its times fit the longer booking and a service with a required extra can be looked up.

**Done when:** tests: one extra booked with the right total, a missing
required extra asks, an unknown extra asks.

---

### A10 · Times, days and prices read and sound normal

**Problem (owner, 2026-10-31):** answers showed "17:50", and the voice
read a list like a script ("17:50 - Sofia - Classic Haircut"). The AI got
raw values (24-hour times, YYYY-MM-DD days, prices in cents) and the
Markdown rule beat the voice "no lists" rule.

**Fix:**
- Every lookup also gives ready-made words in the owner's language, like
  the cards: `timeText` "5:50 PM", `dayText` "Friday, October 31",
  `priceText` "€25.00" (and hours, stats, customers, free times). The raw
  values stay for tool calls. The prompt says to use the Text words.
- In voice, the rules now say they replace the Markdown rule: normal
  sentences, no lists or dashes, never a 24-hour time.
- Safety step before the voice (ElevenLabs normalization guide): list
  dashes and dots become pauses, and any 24-hour time becomes a 12-hour one.

**Files:** `app/api/assistant/tools.ts`, `features/assistant/utils/system-prompt.ts`, `features/assistant/utils/speak-client.ts`, `features/assistant/api/run-chat.ts` (+ tests).

---

Round 2, from the audit of 2026-11-01 (about 15 real questions, typed and
voice). The owner approved A11–A14 (2026-11-01).

### A11 · Money answers match the dashboard 🔴

**Problem:** "How much did I make last week?" answers "Earned: Free" (in
voice: "all freebies"). The app adds up money 3 ways:
- Dashboard revenue (`periodSummary`): kept bookings up to today, minus
  no-shows.
- Customers spent (`customers.ts` SQL): completed bookings only.
- Assistant stats (`bookingStats`): earned = completed only.

Past bookings nobody marked completed count nowhere in the assistant. Totals
also use `priceText`, which turns 0 into "Free".

**Fix:**
- One shared rule in `lib/booking-rules.ts`: a booking is earned when it is
  confirmed or completed and has ended (`endAt <= now`). Expected stays
  "confirmed and not ended".
- `bookingStats`, `periodSummary` and the customers `spentMinor` SQL all use
  that rule.
- Money totals (`earnedText`, `expectedText`, `spentText`) use
  `formatPrice`, so 0 reads "€0.00". A service that costs 0 still reads
  "Free".

**Files:** `lib/booking-rules.ts`, `app/api/assistant/booking-stats.ts`, `features/dashboard/utils/analytics.ts`, `features/dashboard/api/customers.ts`, `features/dashboard/types.ts`, `app/api/assistant/tools.ts`, the two dashboard pages that call `periodSummary` (+ tests).

**Done when:** tests: a past confirmed booking counts as earned in all three
places, a no-show and a cancelled one never do, a zero total reads "€0.00".
Live: the assistant's "last week" money equals the dashboard's revenue.

---

### A12 · A refused action shows as failed

**Problem:** "Mark it completed" on a future booking is refused, but its
step row says "Updated booking ✓". A step fails only when the tool throws;
refusals come back as `{ error }`.

**Fix:** in `run-chat.ts`, a result with an `error` ends its step failed,
with the running label.

**Files:** `features/assistant/api/run-chat.ts` (+ test).

**Done when:** a test: a tool that returns `{ error }` ends its step failed.

---

### A13 · Voice says one short line before lookups

**Problem:** voice said "Got it… Checking extras info… Looking for open
slots…" before the answer. The prompt allows one line, but at minimal
reasoning the model ignores it.

**Fix:** in voice, words stream until the first line is sent. After that,
each turn holds its words like typed chat does, so a line written before
another lookup is never said.

**Files:** `features/assistant/api/run-chat.ts` (+ tests).

**Done when:** tests: three turns (line + lookup, line + lookup, answer)
say only the first line and the answer; a direct voice answer still streams
at once.

---

### A14 · A check that can't run says so

**Problem:** when the check request fails, or a chat reopens during a check,
the row says "Checking the answer…" with a warning icon.

**Fix:** the `check` event also carries `failedLabel` ("Couldn't check the
answer", EN/ES). The reply keeps it on the check step and uses it whenever
the check ends failed on the screen.

**Files:** `features/assistant/types.ts`, `features/assistant/api/run-chat.ts`, `features/assistant/utils/chat-state.ts`, `features/assistant/hooks/use-assistant-chat.ts` (+ tests).

**Done when:** tests: a failed check request and a reopened chat both end
"Couldn't check the answer".

## Decisions

| What | Why | Who, date |
| --- | --- | --- |
| Rate limits stay in memory | One process; a deploy resets them for at most one minute. Waiting cards move to the database (A8) because owners lose them | Dev, 2026-10-31 |
| Memory goes through the client, not a server store | No new table, works with saved chats, and tools already check the business | Dev, 2026-10-31 |
| A failed voice check shows on screen and says one short line | The owner hears the warning without a long stop | Dev, 2026-10-31 |
| The answer check runs after the reply, in its own request (A2) | The reply and picker never wait; A3 reuses it for voice | Owner, 2026-10-31 |
| Money earned = every past booking not cancelled and not a no-show, marked completed or not, everywhere (A11) | Most owners never tap "completed"; one rule so the dashboard, customers and assistant agree | Owner, 2026-11-01 |
