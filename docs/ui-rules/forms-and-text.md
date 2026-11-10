# Forms and text

## Little text

- Short labels. One short helper line at most; more goes behind the ⓘ
  tooltip.
- Empty state = title + one action.
- One main action per screen.
- Headings `text-balance`, paragraphs `text-pretty`.

## Words

Before writing any text people see, look up how Apple, Google and Microsoft
say the same thing, and use the shortest plain words they use.

- Fewer words: check each word needs to be there (Apple: "If you can use
  fewer words, do so"; Microsoft: "Shorter is always better").
- Common words, no jargon, written like you speak; contractions are fine
  ("doesn't").
- Buttons start with a verb, one or two words: "Add receipt", "Replace".
- One word per thing, everywhere, and the word the app already uses
  ("photo", "receipt"). Check the i18n files before adding a new one.
- Sentence case. No full stop on labels, buttons and titles.
- "Your" and "my" only where the meaning needs them; never "we".
- A switch's label says what it does when on.
- An error says what to do next, without blame, next to the problem.
- Numbers as numerals.

## Forms on phones

- Every input has a visible label above it; a placeholder is never the label.
- Right keyboard: `type` (email, tel, url, number) or `inputmode`
  (numeric, decimal, tel, email, search).
- Right Enter key: `enterKeyHint` (next, done, go, search, send).
- Autofill: `autoComplete` (name, email, tel, username, current-password,
  new-password, one-time-code, postal-code …). Turn it off only where
  `lib/no-autofill.ts` says.
- Text at least 16px in inputs (no iPhone zoom).
- Tap targets 44px; inputs on touch too.
- Errors next to the field, in words, not colour alone.
- Never ask for the same thing twice in one flow; keep what was typed.
- Sign-in: allow paste and password managers; no puzzles.

## Spanish and English

- Every string in both; no English on a Spanish page.
- Spanish runs longer, short strings most (a 10-letter English label can
  double). Leave room: no fixed widths on text, allow wrapping, test at 375px.
- `lang` on `<html>` matches the page; mark mixed-language bits.
- Dates, times, numbers, prices: `Intl` through `lib/format-*` and
  `lib/i18n.ts`, never hand-built strings.
