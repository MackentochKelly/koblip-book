# Automatic Spanish

The page's Spanish texts are translated by themselves right after each save,
the way big apps do it. The Settings → Spanish screen and its Translate
button go away everywhere. Asked by the owner (2026-11-06). Each task starts
only after the owner's go.
How to use this file: [Plans](README.md).

## What is there today

- Meta AI (`muse-spark-1.3`) translates, not Google. Google is only used for
  login, Calendar and Maps/Places (`.env.example`).
- Saved in `translations` (one row per text, with the English it came from).
  The public page shows a Spanish text only while its English is unchanged,
  else the English.
- It runs by itself only at sign-up (`app/(owner)/setup/[businessId]/preparing`
  and `/google`, with `after()`) and in two scripts. After that, every edit
  stays in English for Spanish visitors until the owner taps Translate in
  Settings → Spanish or asks the assistant (`translate_page`).

## How others do it

| Who | What | Source |
| --- | --- | --- |
| Shopify | Automatic translation adds missing translations and updates out-of-date machine ones; changed content is flagged as out of date | [Shopify Help](https://help.shopify.com/en/manual/international/languages/translate-adapt-app/automatic-translation), [Translation API: outdated](https://shopify.dev/docs/api/admin-graphql/latest/objects/translation) |
| Next.js | `after()` runs work after the response, in Server Functions; the save never waits | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` |

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| T1 | This plan | | Done (2026-11-06) |
| T2 | Shared engine: move `features/dashboard/utils/translate.ts`, `api/translatable-texts.ts`, `api/translate-business.ts` and their tests to `lib/translations/` (git mv; team-area and admin need it, and features never import each other). Add `translateSoon(business)`: `after()` + the existing one-run-per-business queue, retry after 30 s and 2 min when Meta AI fails. Sign-up pages and scripts use it | T1 | To do |
| T3 | Every save translates: `updateBusinessDetails`; `createService`, `updateService`, `deleteService`; the service category actions (create, find-or-add, update, delete, admin delete); `createAddonGroup`, `updateAddonGroup`, `deleteAddonGroup`; the policy actions (save, save own, remove, save point, remove point); `saveTeamMemberWithHours`, `deleteTeamMember`; the team area's `saveMyProfile`. The assistant saves through these, so it is covered. A test per action | T2 | To do |
| T4 | Remove the Spanish setting: `settings/spanish` route, `spanish-section.tsx`, `translation-actions.ts` and test, `getTranslationStatus`, `translation-types.ts`, the Settings menu entry, its EN/ES words. `/settings/spanish` redirects to Settings (`next.config.ts`, like the other renamed parts) | T2 | To do |
| T5 | Assistant: remove `translate_page`, the Spanish count in the overview, the `spanish` result kind and link, their EN/ES words and tests. Old chats saved on the phone with a Spanish result show it without a link. Keep finding services by their Spanish name | T4 | To do |
| T6 | Admin "Translations" (rule: nothing hidden): each business with texts up to date and waiting, and Translate now | T2 | To do |
| T7 | Docs and `video/knowledge/features-a-to-z.md` (Settings list); typecheck, lint, tests, build; check live in EN and ES: edit a service, see it in Spanish on the page | T3–T6 | To do |

Build order: T2, T3, then T4 and T5, then T6, then T7. The policies plan in
the categories session also changes `policy-actions.ts`: build one after the
other, never at the same time.

## Decisions

| What | Why | Who, date |
| --- | --- | --- |
| Keep Meta AI for translating, no Google Translate | Already built and tested; no new key or bill; the app's AI is Meta's | Developer, 2026-11-06 |
| Translate after each save with `after()` | The official Next.js way; saving stays instant. Production is one long-running Node process that waits for `after()` work when it stops (`docs/deploy.md`) | Developer, 2026-11-06 |
| Only new or changed texts go to Meta AI | Already how the engine works; costs stay small | Developer, 2026-11-06 |
| Until a text is translated (seconds), Spanish visitors see it in English | Same fallback as today and as Shopify | Developer, 2026-11-06 |
| `translations` table stays; no database change | Nothing in it changes | Developer, 2026-11-06 |
