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
| G6 | Coverage check (`npm run i18n:check` and a test): every word has every language; fields and plural forms match English (French and Portuguese have their own plural rules); no English left on a page in another language; a long pseudo-language to test layouts | G4 | Done (2026-11-06): no English typed into pages (`components/ui` words in `app.ui`), every plural has its `one` form in English and Spanish (migration 0058); words added since wait for Google at the next server start |
| G7 | Backfill, only after the owner's go on the cost: a dry run counts the characters first; then Google re-translates every text Meta made and fills the gaps. Meta's text stays on the page until Google's arrives | G3, G0 | Done on the Mac (2026-11-06, owner's go): Google replaced all 180 of Meta's texts (22,995 characters, 0 failed); 602 missing business texts in es, pt and fr went to the queue, sent by the timer within the daily limit; the live site at the next deploy |
| G8 | Portuguese and French: widen the language list (`PageLanguage`, `en`/`es` database enums, language menus, language from the browser, `DEFAULT_LOCALES`), the owner area's and the public page's language menus, emails, legal pages with "translated automatically; the English version applies", WhatsApp templates that the owner submits to Meta, and which languages the assistant's voice can speak. Later languages follow the same steps | G4, G0 | Built (2026-11-06): every area, menu, email, legal page, WhatsApp message and the assistant take `pt` and `fr`; WhatsApp's Spanish moved into the database (migration 0059). Waits for the owner: the server start that sends the words to Google (about 169,000 characters, inside the free 500,000), then the pt and fr WhatsApp templates the owner submits to Meta |
| G9 | Tests and live checks: automatic update after an edit, manual edit kept, missing, failed and retry, fields kept, plurals; every screen at 375px and 1280px, light and dark, in each language; report anything not checked | G3–G6 | Done (2026-11-06): 58 new tests (`lib/translations/g9.test.ts`) for an edit's update, an edit kept, Waiting, Failed and Retry, fields, tags, links and brands kept, and the plurals of all four languages; brand names kept (`brands.ts`, 32 rows sent again); every route in the pseudo-language at 375px and 1280px (108 loads): the home's sample time and three owner screens that ran past 375px fixed; light and dark seen on the home, Integrations and admin Translations. Not checked: the team area (needs a team member's sign-in); real Portuguese and French screens, until Google has sent them (about 3 days at the daily limit); dark mode beyond those three screens |

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
| The shadcn parts' own words (`components/ui`: Close, Loading, Toggle Sidebar, pagination, carousel, audio player…) come from `app.ui` through `useTranslations("app.ui")` inside each shadcn file; a part that takes the word as a prop keeps the prop and uses the word as its default | The root layout gives `app` to every page and `useTranslations` works in server and client components; the files stay as shadcn ships them otherwise | Developer, 2026-11-06 |
| G7's cost: Cloud Translation Advanced NMT, the first 500,000 characters a month free, then $20 a million (cloud.google.com/translate/pricing, read 2026-11-06) | The dry run shows the cost before anything is sent | Developer, 2026-11-06 |
| Legal pages (G8): every language but English shows one line, "Translated automatically. The English version applies.", with a Read in English button to `?lang=en`; Spanish too | The legal words were already app words (`public.legal`, G4), so Portuguese and French come from Google like the rest. Nothing in the code made Spanish binding: it was written against the English, the source. Spanish keeps its hand-checked words (Edited), so "automatically" is loose there; the line's own words go to Google at the next start | Developer, 2026-11-06 |
| Each language's name lives once, in itself (`LANGUAGE_NAMES` in `lib/page-language.ts`: English, Español, Português, Français), for every language menu and the admin's Translations filters; the admin's own "Spanish" word went | One list for every menu; a name in itself is what a visitor looks for, as on Airbnb and Booking.com; shared code, since `components/` can't read a feature | Developer, 2026-11-06 |
| The database's language columns take `PAGE_LANGUAGES` (bookings, notification settings, Book's and Koblip's message texts and templates, automation runs); `drizzle-kit generate` made no migration | SQLite text enums are checked by TypeScript only, with no CHECK in the table. The automations' `wording` and button `label` JSON keep `en`/`es` keys: their shape belongs to the automation work | Developer, 2026-11-06 |
| A booking keeps the language it was made in, any of the four; one the owner adds takes the owner area's | Its messages can then go in the customer's language once WhatsApp has it | Developer, 2026-11-06 |
| Calendars (react-day-picker) speak each language with its own locale (`es`, `ptBR`, `fr`), from `lib/day-picker-locale.ts` | Month and day names and the calendar's labels; English stays the calendar's own | Developer, 2026-11-06 |
| A price with no visitor behind it (a Google Calendar event, setup's preparing card) uses the bare language as its format: Intl reads `en` as the US, `pt` as Brazil, `fr` as France; Spanish stays `es` | The owner's region isn't known there; English and Spanish read as before | Developer, 2026-11-06 |
| Home's evening greeting starts at 18:00 in Portuguese and French ("Boa noite", "Bonsoir"), as in English; Spanish stays 20:00 | How the greetings are used in Brazil and France | Developer, 2026-11-06 |
| Meta's service and extras suggestions write in the owner's language: Brazilian Portuguese with "você", French (France) with "vous"; one shared line (`writingLanguageLine` in `lib/meta-ai.ts`) | Writing, not translating, as the assistant does; the usual address in each | Developer, 2026-11-06 |
| `lang` attributes stay the app's code (`pt`, `fr`), as `es` does | Valid BCP 47 tags; CLDR's own `pt` is Brazilian Portuguese | Developer, 2026-11-06 |
| The queue, edit and backfill tests run in Spanish only (the queue's `languages`; a mocked list in the backfill test); new tests check a save waits in every language, each sent with Google's code, and the dry run counts each language | Their fixtures follow one text; the new tests cover what Portuguese and French change | Developer, 2026-11-06 |
| The assistant's language line is a prompt in code, "Reply in English / Spanish / Brazilian Portuguese / French." (`ASSISTANT_LANGUAGES` in `lib/assistant-rules.ts`); the unused `assistantServer.languageLine` word is removed | It tells the model, not the owner; Google would make "Reply in English." into "Responda em inglês."; every other prompt is English code. Meta lists no language limit for Muse Spark ([models](https://dev.meta.ai/docs/models), read 2026-11-06) | Developer, 2026-11-06 |
| Live hearing biases toward Meta's name for the owner's language: English, Spanish, Portuguese, French (`app/api/voice/check`) | Muse Voice Transcribe lists 25 languages, Portuguese and French among them, without regions; `languageBias` takes names like `["English", "French"]` ([speech to text](https://dev.meta.ai/docs/speech-to-text), [voice schemas](https://dev.meta.ai/docs/api-reference/voice/schemas), read 2026-11-06) | Developer, 2026-11-06 |
| The voice speaks Portuguese and French with the same model, `eleven_v4_turbo`; no `language_code` is sent | Meta has no speech model ("does not synthesize speech", [models](https://dev.meta.ai/docs/models)); ElevenLabs lists French (fr) and Portuguese (pt) for v4 Turbo on the Text to Dialogue socket ([models](https://elevenlabs.io/docs/overview/models)); the socket page gives `language_code` no meaning ([TTD socket](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket)), all read 2026-11-06 | Developer, 2026-11-06 |
| The voice picker gets a Portuguese and a French tab from each account voice's verified languages, named by `LANGUAGE_NAMES`; with no voice for the owner's language, Start talking stays off and text chat stays, as for Spanish today | A voice's `verified_languages` (language, model, locale, preview) is what says it speaks a language ([voices](https://elevenlabs.io/docs/api-reference/voices/search), read 2026-11-06) | Developer, 2026-11-06 |
| Talking in Portuguese or French uses the English talking rules set to that language, talking to the owner as você and vous; Spanish keeps its own; the talk's own lines likewise | One checked set of rules; the same forms of address as the suggestions' `writingLanguageLine` | Developer, 2026-11-06 |
| A talk turns 24-hour times into AM and PM only in a language whose times say them (en-US, es-US); Portuguese and French keep "17:50" | The tools write times in `DEFAULT_LOCALES`; `Intl`'s hour cycle for pt-BR and fr-FR is 24-hour | Developer, 2026-11-06 |
| The assistant's WhatsApp tools take every template language: their "language must be one of …" error lists them, cards name Portuguese and French, and Book's own buttons come from `bookWordsFor` | `TemplateLanguage` is now every page language | Developer, 2026-11-06 |
| WhatsApp template languages sent to Meta: English `en`, Spanish `es`, Portuguese (Brazil) `pt_BR`, French `fr` (`META_LANGUAGES` in `features/dashboard/utils/booking-templates.ts`); Book keeps its own codes and only Chat's create, find and send use Meta's | Meta's supported languages list them so, and `pt` alone is not Brazilian ([supported languages](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/supported-languages), read 2026-11-06); Chat passes the code through | Developer, 2026-11-06 |
| WhatsApp's template languages are every page language (`TEMPLATE_LANGUAGES = PAGE_LANGUAGES`): the owner's and Koblip's editors, setup, Integrations and the K3 rule (a business's own number sends only when every turned-on message is approved in every language) count Portuguese and French | One list, so a later language comes the same way. Until the owner submits and Meta approves Portuguese and French, a business with its own number sends from Koblip's number, and Koblip's own set needs them submitted too; nothing is submitted for the owner | Developer, 2026-11-06 |
| Book's default WhatsApp words are app words (`owner.whatsapp.bookWording`: the messages, footer, buttons, sample service and address, the words for a missing team member or price, the thank-you, the Welcome flow); Portuguese and French are Google's, read on the server (`features/dashboard/api/message-words.ts`), with the English until Google's arrives and an admin's edit winning; Spanish stays the hand-written text in code | English has one source and Portuguese and French come as every other word does. Spanish is the text Meta approved and that the 'changed since Book's words' checks compare with, so moving it needs a migration importing it as Edited (as the app's Spanish words were), not done here; Google's Spanish of these keys is unused until then | Developer, 2026-11-06 |
| A Portuguese or French message's sample values: names and the phone stay English; service and address are Google's; the date, time, length and price are written by `Intl` in `pt-BR` and `fr-FR`, the price in BRL and EUR | Only Meta's reviewer and the editor's preview read them; the format of each region is what a reviewer expects | Developer, 2026-11-06 |
| The message editors switch language with the shared `AppSelect` (shadcn Select) and `LANGUAGE_NAMES`, not two tabs | Four languages don't fit as tabs at 375px; one menu, as every other language menu | Developer, 2026-11-06 |
| The editors' live preview gets each language's sample values from the server (`bookExamples`) | Portuguese and French samples come from the app's words in the database, which client code can't read | Developer, 2026-11-06 |
| The Welcome flow has every language: a flow saved before Portuguese and French reads Book's words for them (`withEveryLanguage`), and while it is still Book's own (`isDefault`) Google's newest translation shows; the reply goes in the customer's booking language, else English | The automations' JSON keeps what was saved, so no migration; the owner's own words are never replaced | Developer, 2026-11-06 |
| The owner's alert language takes any page language | The owner area speaks all four | Developer, 2026-11-06 |
| Book's English and Spanish WhatsApp words are app words too, read like Portuguese and French (`bookWordsFor`, `welcomeWords`): the English is only in `whatsapp-wording.ts`; the hand-written Spanish moved into `translation_entries` as Edited (migration `0059_whatsapp_spanish_words`, 38 words, logged as imported) and left the code. Every sample value is a word (`examples.*`) but the business name, the same in every language, and the length, from `app.duration`; this replaces the `Intl` samples for Portuguese and French. A Welcome flow still Book's own (`isDefault`) shows Book's newest words in every language | One English and one place for every language, and an admin can fix any of them on Translations. Meta approved the Spanish, and its samples ("viernes 8 de mayo", "35,00 €") are no `Intl` format, so they are words to stay the same to the byte; a test checks English and Spanish against a capture of the old code (`message-words.captured.ts`). Portuguese and French samples read the English until Google's arrive at the next start | Developer, 2026-11-06 |
| The home's sample booking time is code (`SAMPLE_BOOKING_TIME` in `components/feature-preview.tsx`), shown through `formatClock` in the page's locale | It is a time, not a word: as a word, "15:00" went to Google and next-intl read it as ICU; each language now shows it the way its region writes times | Developer, 2026-11-06 |
| Brand names are kept as fields are, in both paths (business texts and the app's words): one list, `BRAND_NAMES` in `lib/translations/brands.ts` (Koblip Book, Koblip Chat, Koblip, WhatsApp, Google Business Profile, Google Calendar, Google Search, Google Maps, Google, Meta AI, Meta, Muse Voice Transcribe, Muse Spark, Muse Image, Muse, Instagram, Facebook, TikTok, GitHub, ElevenLabs, iPhone, iPad, Android, Gmail), whole words, case-sensitive, longest first, sent in `<span translate="no">` and checked on return: Google's answer with a brand lost or changed isn't used. A sentence of only brands and fields isn't sent. An admin's own edit isn't held to them. The two admin words where "Book" meant the app now say "Koblip Book". Google's earlier translations that lost or changed a brand go back to Google once, as Reset to Google does (local dry run: 34 rows, 1,912 English characters, about 2,400 billed) | G9: Google made "Book's wording" "Texto do livro" and changed "Koblip Chat", "Google Calendar" and "Google Business Profile". Google leaves `translate="no"` untouched in `text/html` ([troubleshooting](https://docs.cloud.google.com/translate/troubleshooting), read 2026-11-06). Longer names the app's words use joined the list, so none is kept by half; brands that are also common words (Apple, Outlook, Stripe) stay off it, so a business's "Apple pie" still translates. Only those, not all 276 with a brand: the rest kept theirs, so sending them again would cost and change nothing | Developer, 2026-11-06 |
