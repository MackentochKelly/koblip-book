# Forms and text

## Little text

- Short labels. One short helper line at most; more goes behind the ⓘ
  tooltip.
- Empty state = title + one action.
- One main action per screen.
- Headings `text-balance`, paragraphs `text-pretty`.

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
