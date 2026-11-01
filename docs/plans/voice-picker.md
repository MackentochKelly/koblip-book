# Voice picker

Each owner chooses the voice that talks to them in live voice. Today every
owner hears one voice, fixed in `lib/voice-rules.ts` (`speakVoiceId`). The
owner approved this plan (2026-11-01). We build it one task at a time, in
order. How to use this file: [Plans](README.md).

## Rules for every task

- Read the official docs first (ElevenLabs API and SDK, ElevenLabs UI,
  the bundled Next.js docs). Never guess an API, option or field.
- The ElevenLabs key stays in server code (`server-only`).
- Every task adds tests. All of typecheck, lint and test must pass.
- Keep the look. Only shadcn and ElevenLabs UI parts and theme tokens (see
  `docs/ui-rules/checklist.md`).
- Nothing hidden: every new stored record gets an admin screen.
- English and Spanish for every new word the owner sees or hears.

## Tasks

| Task | What | Size | Needs | Status |
| --- | --- | --- | --- | --- |
| V1 | Voices list and each owner's saved voice | M | | Working on: M Kelly B, 2026-11-01 |
| V2 | Picker in the talk dialog and Settings → Account | M | V1 | To do |
| V3 | Add the 4 most used voices, live check | S | V2 | To do |

---

### V1 · Voices list and each owner's saved voice

**Problem:** the voice is fixed in code, and the browser sends a voice id
that the server ignores.

**Fix:**
- The voices are the ones saved in the app's ElevenLabs account ("My
  Voices", not the built-in ones), read with the official ElevenLabs SDK
  and cached for an hour.
- New table `owner_voices`: one chosen voice per owner. Saving checks the
  voice is in that list.
- `/api/voice/speak-token` speaks with the owner's saved voice only. No
  choice yet, or a voice no longer in the list: it answers "no voice" so
  the screen asks.
- Admin owners list shows each owner's voice.

**Files:** `lib/db/schema.ts`, a new migration, `features/assistant/api/voices.ts` (new), `features/assistant/api/voice-actions.ts` (new), `app/api/voice/speak-token/route.ts`, `lib/voice-rules.ts`, `features/admin/api/queries.ts`, `features/admin/components/owners-list.tsx` (+ tests).

**Deploy:** run `npm run db:migrate` (new table).

**Done when:** tests: the list is read and cached, a voice outside the list
is refused, speak-token uses the saved voice and answers "no voice" when
there is none or it is gone.

---

### V2 · Picker in the talk dialog and Settings → Account

**Fix:**
- ElevenLabs UI parts (`voice-picker` item, `audio-player`, `orb`),
  installed with the shadcn CLI from the ElevenLabs UI registry.
- One shared picker list: search, scroll, play each voice's ElevenLabs
  preview, choose.
- The first live talk: after Continue in "Talk to your assistant", the
  same dialog shows the list; choosing starts talking. No default voice.
- Settings → Account: a Voice row that opens the same list.
- A "no voice" answer from speak-token opens the picker.

**Files:** `components.json`, `components/ui/*` (registry parts), `components/voice-picker-list.tsx` (new, shared), `features/assistant/components/voice-intro.tsx`, `features/assistant/hooks/use-live-voice.ts`, `features/dashboard/components/account-section.tsx`, `app/(owner)/dashboard/[businessId]/settings/account/page.tsx`, i18n files (+ tests).

**Done when:** tests and a live check at 375 px, light and dark: the first
talk asks, a sample plays, the chosen voice speaks, Settings changes it.

---

### V3 · Add the 4 most used voices, live check

**Fix:** add the 2 most used English and 2 most used Spanish voices from
the ElevenLabs Voice Library (by its usage numbers, not by taste) to the
account. Then check the whole flow live, including a removed voice.

**Done when:** the 4 voices show in the picker and speak.

## Decisions

| What | Why | Who, date |
| --- | --- | --- |
| The list = voices saved in the app's ElevenLabs account | The owner chooses what is offered there; no hard-coded list; no surprise costs or vanishing library voices | Owner, 2026-11-01 |
| Pick at the first live talk and in Settings → Account; no default voice | The owner wants every owner to choose | Owner, 2026-11-01 |
| The sample is each voice's own ElevenLabs preview | Free and made by ElevenLabs; a custom script would cost credits on every play | Owner, 2026-11-01 |
| One voice per owner, not per business | "Each owner chooses their own" | Owner, 2026-11-01 |
