# Translations (Google Cloud Translation)

The whole app is translated by Google Cloud Translation, by itself, whenever
English text is created or changed. That covers interface words and each
business's own texts. Admins see and fix every translation. Meta is never
used to translate, not even as a fallback. The Settings → Spanish screen and
its Translate button go away.
Asked by the owner (2026-11-06); replaces the "Automatic Spanish" plan. No
task starts, no paid service is turned on and no bulk translation runs until
the owner says go.
How to use this file: [Plans](README.md).

## Language scope (chosen by the owner, 2026-11-06)

| Language | In the app | Sent to Google as | Money and dates |
| --- | --- | --- | --- |
| English (source) | `en` | — | `en-US` |
| Spanish | `es` | `es` | `es-US` |
| Portuguese (Brazil) | `pt` | `pt-BR` | `pt-BR` |
| French | `fr` | `fr-FR` | `fr-FR` |

- Everything is written in English first.
- A browser in any Portuguese gets Brazilian Portuguese; any French gets
  French (France). The visitor's own region still sets how money and dates
  look (`pickLocale`).
- Later: any other language Google supports (about 194 for the NMT model),
  each only after the owner approves it and its cost.

## What is there today (audit, 2026-11-06)

| Text source | Where | Today |
| --- | --- | --- |
| Interface words | 20 word files: `features/*/i18n`, `lib/i18n.ts`, `lib/app-words.ts`, `lib/email-templates.ts`, `features/legal/content.ts`, `features/onboarding/i18n.ts`, `features/owner-auth/i18n.ts`… About 3,800 strings, about 85,000 characters (English and Spanish together) | Spanish written by hand. Plurals and fields are TypeScript functions (`(n) => \`${n} to translate\``) |
| Words typed straight into code | `app/(public)/b/[slug]/error.tsx`, `not-found.tsx`, page titles "Koblip Book", "Admin" | English only |
| Business texts | `translations` table: About, business type, services, service categories, extras, team job title and About, policies, policy points | Meta AI (`muse-spark-1.3`, `features/dashboard/utils/translate.ts`), only at sign-up, in two scripts, or when the owner taps Translate or asks the assistant (`translate_page`) |
| Owner's own message wording | `notification_texts`, `koblip_notification_texts` (one row per language) | Written by the owner in each language. WhatsApp sends them as templates that Meta approves per language |
| Dates, numbers, prices | `lib/page-language.ts` `pickLocale`, `Intl` | Already locale-aware |
| Languages | `PageLanguage = "en" \| "es"`, and `en`/`es` enums in the database | Fixed to two |

About 4,000 characters of business text per business today (local data: 6
businesses, at most 4,600). No Google translation code or key exists: Google
is used only for sign-in, Calendar and Maps/Places.

## Not translated

- Business, people and brand names (Koblip, WhatsApp, Google…), addresses,
  links, emails and phone numbers.
- Fields like `{name}` and `{service}`, sent to Google wrapped in
  `<span translate="no">` and checked after the translation comes back.
- What customers and owners type to each other (notes, chat replies).
- The assistant's spoken and written answers: Meta AI writes them directly
  in the owner's language. That is writing, not translating. Its fixed words
  (buttons, cards) are interface words, translated by Google.
- WhatsApp message templates: each language needs Meta's approval. The
  owner submits them (G8).

## How others do it

| Topic | What they do | Source |
| --- | --- | --- |
| Which Google API | Advanced (v3) for new projects; it accepts only service accounts, not API keys | [API overview](https://docs.cloud.google.com/translate/docs/api-overview), [Editions](https://docs.cloud.google.com/translate/docs/editions) |
| Least access | `roles/cloudtranslate.user` translates; admin and editor give more | [Access control](https://docs.cloud.google.com/translate/docs/access-control) |
| Login from our own server | Keyless Workload Identity Federation first; a service account key only when federation is not possible; you keep the key safe | [ADC outside Google Cloud](https://docs.cloud.google.com/docs/authentication/set-up-adc-on-premises) |
| Setup | One project per environment, billing on, `translate.googleapis.com` on, set a daily quota (unlimited by default) | [Setup](https://docs.cloud.google.com/translate/docs/setup) |
| Limits | 6,000,000 characters a minute; 30,000 per request at most, 5,000 recommended | [Quotas](https://docs.cloud.google.com/translate/quotas) |
| Keep words as they are | `translate="no"` or `class="notranslate"` in `text/html` requests; still billed | [Troubleshooting](https://docs.cloud.google.com/translate/troubleshooting) |
| Changed English | Machine translations update when the source changes; changed content is flagged as out of date | [Shopify](https://help.shopify.com/en/manual/international/languages/translate-adapt-app/automatic-translation), [Shopify API](https://shopify.dev/docs/api/admin-graphql/latest/objects/translation) |
| Manual edits | Kept when the source changes and marked for review; approved ones are never overwritten | [Crowdin](https://support.crowdin.com/version-management/), [Crowdin workflow](https://discourse.gbif.org/t/crowdin-translation-workflow/537) |
| Plurals and fields | ICU message syntax (`{count, plural, one {…} other {…}}`), plural forms from `Intl.PluralRules`; messages can be loaded from any source | [next-intl](https://next-intl.dev/docs/usage/translations), [next-intl config](https://next-intl.dev/docs/usage/configuration) |
| Next.js | Language from `Accept-Language` or a cookie; work after the response with `after()` | `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`, `…/04-functions/after.md` |

## Price (checked 2026-11-06, [Google pricing](https://cloud.google.com/translate/pricing))

| Item | Price |
| --- | --- |
| NMT model (what we use) | First 500,000 characters a month free (a $10 monthly credit, shared by Basic and Advanced), then **$20 per million characters** |
| Translation LLM | $10 per million in plus $10 per million out |
| What counts | Every character sent, spaces and HTML tags included; words marked "do not translate" too; an empty request counts as 1 |

Estimates. The number of live businesses was not checked (production was
not read):

| Job | Characters | Cost |
| --- | --- | --- |
| Interface words into Portuguese and French | about 120,000 to 180,000 (60,000–90,000 each) | Free inside one month's allowance; at most about $4 |
| Spanish interface words | 0: today's hand-written Spanish is kept | $0 |
| One business's texts into Spanish, Portuguese and French | about 12,000 to 30,000 (4,000–10,000 per language) | One-time backfill: 100 businesses ≈ 1.2–3M, about $14–50. 1,000 businesses ≈ 12–30M, about $230–590 |
| Everyday edits | Only changed texts, into 3 languages; the same text is translated once and reused | Usually inside the free 500,000 |

Safeguards: a daily character quota and a budget alert in Google Cloud, and a
daily limit per business in the app (demo guests can save too). The backfill
runs in monthly parts if the owner wants to stay inside the free allowance.

## Google setup the owner does (G0)

Steps 1–5 done 2026-11-06, in the console at the owner's request. The owner
makes and stores the key; the developer never handles it.

1. One Google Cloud project, `koblip-book`, for the Mac and the live site.
2. Billing on, with the budget "Koblip translation": $10 a month, project
   `koblip-book`, service Translate, emails at 50%, 90% and 100%.
3. Turn on the Cloud Translation API (`translate.googleapis.com`).
4. Daily quota "v2 and v3 general model characters per day": 1,000,000.
5. Service account `koblip-translate@koblip-book.iam.gserviceaccount.com`
   with only Cloud Translation API User (`roles/cloudtranslate.user`).
6. A key for it (Mac done 2026-11-06: owner made it, kept at
   `~/.config/koblip/koblip-translate.json`, mode 600, both lines in
   `.env.local`; live server: copy it there at the next deploy). Our server is not on Google Cloud and has no identity
   provider for keyless login. Put the key file on the server outside the
   app folder, readable only by the app, and its path in `.env.local` as
   `GOOGLE_APPLICATION_CREDENTIALS`, plus `GOOGLE_CLOUD_PROJECT`. Never in
   the repo, never in the browser.

## Tasks

| Task | What | Needs | Status |
| --- | --- | --- | --- |
| G0 | Owner: Google setup above, and go for the cost | G1 | Done on the Mac (2026-11-06; first real call through the engine: 52 characters, field kept); live server key at the next deploy |
| G1 | This plan | | Done (2026-11-06) |
| G2 | Engine in `lib/translations/` (server only): the `@google-cloud/translate` v3 client, NMT model, `text/html` with fields wrapped in `translate="no"` and checked on return, requests of 5,000 characters at most; reuse of earlier translations; `translation_entries` (interface or business, page or business, key, language, English, its fingerprint, translation, Google's own version, state, attempts, next try, error) and `translation_history` (who, when, before, after, why); a queue: saving adds work and `after()` starts it, and a timer in `instrumentation.ts` picks up what is left; retries at 1 min, 5 min, 30 min and 2 h, then Failed. A fake Google in development and tests | G1 | Done (2026-11-06) |
| G3 | Business texts on Google: today's `translations` rows move into `translation_entries` (as `meta`, still shown) and the old table goes, in the same change that moves the page and the saves to the new one; every save adds only changed texts (business details, services, categories, extras, policies with the owner's own title, team, the team area's profile) and removals clean up; Meta translation code removed; Settings → Spanish removed (`/settings/spanish` goes to Settings); the assistant's `translate_page` and its Spanish count removed; services still found by their Spanish name | G2 | Done (2026-11-06; local: 180 Meta rows moved, one real Google run) |
| G4 | Interface words: one shared message system (next-intl, ICU: plurals, fields, `Intl` dates, numbers and money); every word file moved to it, one feature at a time; words typed into code moved too; English stays in code; a sync puts every word into `translation_entries`; today's Spanish comes in as Manual so it is kept; pages read their language from the database through a cache, with English as the fallback | G2 | Done (2026-11-06; local: 2,823 Spanish words moved as Edited) |
| G5 | Admin "Translations", using the existing admin layout and parts: Interface and Business texts tabs; search; filters for language, page or business, and state; pages of results; English beside the translation; states Missing, Waiting, Failed, Automatic, Edited, Needs review; edit and save, Reset to Google, Retry; history; characters sent to Google this month; the rules (`lib/translations/rules.ts`: retries, daily limit) shown and changeable. Admins only; every change logged | G2 | Done (2026-11-06) |
| G6 | Coverage check (`npm run i18n:check` and a test): every word has every language; fields and plural forms match English (French and Portuguese have their own plural rules); no English left on a page in another language; a long pseudo-language to test layouts | G4 | Built (2026-11-06); open: 28 English words in `components/ui` and 5 English plurals without a `one` form |
| G7 | Backfill, only after the owner's go on the cost: a dry run counts the characters first; then Google re-translates every text Meta made and fills the gaps. Meta's text stays on the page until Google's arrives | G3, G0 | Ready (2026-11-06): dry run 32,004 characters, inside the free 500,000; waits for the owner's go |
| G8 | Portuguese and French: widen the language list (`PageLanguage`, `en`/`es` database enums, language menus, language from the browser, `DEFAULT_LOCALES`), the owner area's and the public page's language menus, emails, legal pages with "translated automatically; the English version applies", WhatsApp templates that the owner submits to Meta, and which languages the assistant's voice can speak. Later languages follow the same steps | G4, G0 | To do |
| G9 | Tests and live checks: automatic update after an edit, manual edit kept, missing, failed and retry, fields kept, plurals; every screen at 375px and 1280px, light and dark, in each language; report anything not checked | G3–G6 | To do |

Build order: G2, then G3, then G5, then G4 one feature at a time, then G8
(Portuguese and French), then G6, G9, G7. G4 touches every screen: never build it at
the same time as another session working on the same screens. The policies
work in the categories session also changes `policy-actions.ts` and adds the
owner's own policy title.

## Decisions

| What | Why | Who, date |
| --- | --- | --- |
| Languages: English (source), Spanish, Portuguese (Brazil), French | Owner's choice | Owner, 2026-11-06 |
| French is France French (`fr-FR`); Canadian French can come later as its own language | Google lists both; one French first keeps cost and checks small | Developer, 2026-11-06 |
| Google Cloud Translation Advanced (v3), NMT model | Google's choice for new projects; service accounts with roles, no API keys; the free 500,000 characters a month | Developer, 2026-11-06 |
| No Meta for translating, not even as a fallback | Owner's rule. When Google fails, the text waits or shows Failed, and the English shows | Owner, 2026-11-06 |
| Edited translations are never overwritten | When the English changes, they stay and show Needs review | Developer, 2026-11-06 |
| Automatic translations update when the English changes | As Shopify does | Developer, 2026-11-06 |
| Today's hand-written Spanish words are kept as Edited | They are checked already; it also costs nothing | Developer, 2026-11-06 |
| next-intl with ICU messages for interface words | The standard for Next.js; plurals and fields are text that Google can translate, not code; messages can come from the database | Developer, 2026-11-06 |
| Saving never waits for Google | The queue and `after()` do the work after the save | Developer, 2026-11-06 |
| One Google project for the Mac and the live site | Owner's choice: start now, no separate setup later | Owner, 2026-11-06 |
| Today's `translations` rows move in G3, not G2 | Moving them while the old code still writes the old table would leave two copies apart | Developer, 2026-11-06 |
| The engine saves with `saveAll` inside `runInTurn` per business | The app's rule for check-then-save on SQLite (`eslint.config.mjs`); a newer English or an admin edit made while Google works always wins | Developer, 2026-11-06 |
| Only Google's own automatic translations are reused for the same English | An admin's edit for one business never shows up in another's | Developer, 2026-11-06 |
| The fake translator runs only with `TRANSLATION_PROVIDER=fake`, never in production; its texts are marked `fake` and made again by Google | Local work without a Google key never leaves test text live | Developer, 2026-11-06 |
| Daily limit of 50,000 characters per business; the rest waits for the next day (UTC) | A safeguard against cost, demo guests included | Developer, 2026-11-06 |
| History keeps a removed text's rows (`entry_id` empty) | Billed characters and admin edits stay on record | Developer, 2026-11-06 |
| `@google-cloud/translate` is in `serverExternalPackages` | It loads its gRPC files from `node_modules` at run time; production installs packages with `npm ci` | Developer, 2026-11-06 |
| A save syncs the whole business, not just the field that changed | One shared function for every save; the fingerprint check sends only what changed; a missed field can't happen. A business's texts Meta never translated go to Google at its next save (local data: about 9,000 characters for all 13 real businesses) | Developer, 2026-11-06 |
| Demo copies are never translated | Guests' throwaway copies, removed within days: no cost. Their page shows English in another language, as before | Developer, 2026-11-06 |
| The text fingerprint is SHA3-256 | libSQL computes it too (`sha3()`), so the move of Meta's rows fills it in SQL in the same migration that drops the old table | Developer, 2026-11-06 |
| The scripts `about:write` and `category:fix` don't translate | One-off tools for businesses before sign-up; the next save sends their texts | Developer, 2026-11-06 |
| Missing and Waiting are one state, Waiting | Every text without a translation is in the queue already; a second name for it would only confuse | Developer, 2026-11-06 |
| Reset to Google sends the text to Google again | The English may have changed since Google's last version; the same English is reused at no cost | Developer, 2026-11-06 |
| Admins can change five rules: retry waits, characters a business can send a day, texts per run, characters and texts per request | Stored as `translation.*` in `platform_settings`, each checked against Google's limits and logged; Translations → History shows them, WhatsApp's change log does not. The timer, the request timeout and the longest text stay in code: they are read at start-up or are Google's own limits | Developer, 2026-11-06 |
| The shadcn Pagination file was written from shadcn's own source on GitHub | ui.shadcn.com did not answer, so `npx shadcn add` could not run; the file is the base-luma one the command makes | Developer, 2026-11-06 |
| next-intl 4 without i18n routing; its locale is the format one ("es-ES"), the language comes from proxy.ts's page language | Links and pages stay as they are; numbers and dates keep reading as in the visitor's region | Developer, 2026-11-06 |
| Each area keeps its English words in its own file (`as const`); `i18n/messages.ts` lists them all | next-intl then checks every key and every ICU field in the typecheck | Developer, 2026-11-06 |
| Today's Spanish words moved into `translation_entries` as Edited by a migration, and the Spanish files went | Checked already, so Google never redoes them: no cost; one place for every language | Developer, 2026-11-06 |
| The app's words go to Google sentence by sentence: plurals and selects lifted first (formatjs `hoistSelectors`), fields and tags kept, used only when `isStructurallySame` | Google never sees ICU syntax, and a translation that lost a field shows the English | Developer, 2026-11-06 |
| The words of each language are kept in memory and read again after any change; a database error shows the English | Pages never wait on the database for words; a Spanish page never errors over words | Developer, 2026-11-06 |
| The app's words sync when the server starts; a word whose key changes but whose English doesn't keeps its translation | Releases bring their words with them; renaming never loses an admin's edit | Developer, 2026-11-06 |
| The app's own words share the daily limit as one more business (50,000 characters a day) | A release with many new words never sends them all in one day | Developer, 2026-11-06 |
| Keys never contain dots | next-intl reads a dot as nesting; the admin's text kinds are grouped by table instead | Developer, 2026-11-06 |
| A long made-up language for layout checks, in development only (`I18N_PSEUDO=1`) | G6: long words show where a layout breaks, without a real language | Developer, 2026-11-06 |
| Words only the server sends (emails, a booking's Google Calendar event) live in `appServer`, apart from `app` | `app` goes to every page; these never show on one | Developer, 2026-11-06 |
| G7's cost: Cloud Translation Advanced NMT, the first 500,000 characters a month free, then $20 a million (cloud.google.com/translate/pricing, read 2026-11-06) | The dry run shows the cost before anything is sent | Developer, 2026-11-06 |
