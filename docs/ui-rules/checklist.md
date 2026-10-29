# Checklist

Every UI change, before and after. Each line must pass.

## Parts

- [ ] Uses a shared part (`components/ui`, `components/`) or a ready-made
      registry component. No hand-made copy, no one-off variant.
- [ ] `components/ui` files are stock shadcn (only `icons.tsx` is ours).
- [ ] Colours, radius, spacing come from theme tokens. No hex, no
      arbitrary px.
- [ ] Values someone may want to change live in one rules/config file
      (`lib/*-rules.ts`), not scattered numbers.

## Phone (375x812)

- [ ] No sideways scroll: `document.documentElement.scrollWidth` = 375.
- [ ] Works at 320px wide too (WCAG reflow).
- [ ] Every tap target is at least 44x44px (visible or invisible tap area).
- [ ] Nothing under the notch, home bar or keyboard (safe areas).
- [ ] The page scrolls, not a box inside it (except full-screen app views).
- [ ] Text inputs are at least 16px text (stops iPhone zoom).

## Computer (1280x800 and 1920x1080)

- [ ] Targets at least 24x24px.
- [ ] Every action works with the keyboard; focus ring always visible and
      never hidden under a sticky bar or sheet.
- [ ] Hover is a bonus, never the only way to find something.
- [ ] Reading width stays comfortable (about 66 characters for long text).
- [ ] Page content uses `max-w-page`; at 1920 it is 1296px wide with 18px
      text, and nothing is sized in px.

## Look

- [ ] Light and dark both checked.
- [ ] Text contrast 4.5:1 (3:1 for large text); icons and control edges 3:1.
- [ ] One main action per screen.
- [ ] One short helper line at most; more goes behind the ⓘ tooltip.
- [ ] Empty state = title + one action.

## Motion

- [ ] Animates only `transform` and `opacity`.
- [ ] Short: 150-300ms for most UI, never makes people wait.
- [ ] Reduce Motion on: slides and zooms become fades or nothing.
- [ ] Nothing moves by itself for more than 5s without a way to stop it.

## Behaviour

- [ ] Loading, empty and error states exist.
- [ ] Removing something asks first (`ConfirmRemove`).
- [ ] Toasts/status messages are announced to screen readers.
- [ ] Icon-only buttons have a label.
- [ ] Dialogs and sheets: focus goes in, Esc closes, focus comes back.
- [ ] Anything done by dragging also works by tapping.

## Language

- [ ] English and Spanish both checked: no English on a Spanish page,
      nothing cut off (Spanish runs longer).
- [ ] Dates, times, prices through `Intl` / `lib/format-*`.

## Done

- [ ] Typecheck, lint, related tests, build pass.
