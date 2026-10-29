# Accessibility

**Build to WCAG 2.2 AA.** It is the current W3C standard (edition of
12 Dec 2024, also ISO/IEC 40500:2025). Later errata are wording only.
WCAG 3.0 is still a draft and does not replace 2.2: don't build to it.

## Laws (why AA matters)

| Law | Standard |
|---|---|
| European Accessibility Act (since 28 Jun 2025) | EN 301 549 V3.2.1 = WCAG 2.1 AA today; V4.1.1 (WCAG 2.2 AA) expected in the EU Official Journal Dec 2026 |
| US ADA Title II (public bodies) | WCAG 2.1 AA, deadlines 26 Apr 2027 / 26 Apr 2028 |
| US Section 508 (federal) | WCAG 2.0 AA |

WCAG 2.2 AA covers all of them.

## The rules that matter most for our screens

| Rule | Level | What it means here |
|---|---|---|
| 1.3.4 Orientation | AA | Never lock portrait or landscape |
| 1.4.3 Contrast | AA | Text 4.5:1, large text (24px, or 18.5px bold) 3:1. 4.499 fails |
| 1.4.4 Resize text | AA | Works at 200% text size |
| 1.4.10 Reflow | AA | No sideways scroll at 320px wide |
| 1.4.11 Non-text contrast | AA | Icons, control edges, states 3:1 |
| 1.4.12 Text spacing | AA | Nothing breaks with bigger line/letter/word spacing |
| 2.2.2 Pause, stop, hide | A | Auto-moving content over 5s needs a stop control |
| 2.4.7 Focus visible | AA | Keyboard focus always shows |
| 2.4.11 Focus not obscured | AA | Focus never fully hidden by sticky bars or sheets |
| 2.5.7 Dragging | AA | Every drag also works with taps (drawers: a close button) |
| 2.5.8 Target size | AA | At least 24x24px, or spaced so 24px circles don't touch |
| 3.2.6 Consistent help | A | Help/contact always in the same place |
| 3.3.2 Labels | A | Every input has a label |
| 3.3.7 Redundant entry | A | Never ask for the same thing twice in one flow |
| 3.3.8 Accessible sign-in | AA | No memory or puzzle tests; allow paste and password managers |
| 4.1.2 Name, role, value | A | Every control has a name and role |
| 4.1.3 Status messages | AA | Toasts and "saved" are announced without moving focus |

## House rules above AA

These are AAA or platform rules we follow on purpose:

- **44x44px tap areas on touch screens** (WCAG 2.5.5 AAA, Apple 44pt;
  Android asks 48dp). We switch by input, not screen size: `pointer-coarse:`.
  The shared `Button` already adds an invisible 44px tap area; `ViewTabs`
  does the same.
- **Focus ring** clear and thick enough to see (2.4.13 AAA): keep shadcn's
  `focus-visible:ring`.
- **Motion can be turned off** (2.3.3 AAA): see [motion.md](motion.md).

## Keyboard patterns (WAI-ARIA APG)

Base UI builds these in. Check them when composing parts:

| Pattern | Keys |
|---|---|
| Dialog / sheet | Focus moves in, Tab loops inside, Esc closes, focus returns |
| Menu | Enter/Space opens, arrows move, Enter runs, Esc closes |
| Tabs | Arrows move between tabs, Tab goes to the panel |
| Combobox | Focus stays in the input, Down opens, Enter picks, Esc closes |
| Listbox | Arrows, Home/End, typing jumps |
| Disclosure (collapsible) | A button with `aria-expanded`, Enter/Space toggles |

Base UI does not style focus, check contrast or label custom controls: we do.

## User settings to respect

| Setting | Support | Our rule |
|---|---|---|
| `prefers-reduced-motion` | All browsers | Use `motion-safe:` / `motion-reduce:` |
| `prefers-color-scheme` | All browsers | Dark mode follows the system by default |
| `prefers-contrast` | All browsers | `contrast-more:` where a thin line or faint text matters |
| `forced-colors` | All browsers (Windows) | Borders must still show; don't rely on background colour alone |
| `prefers-reduced-transparency` | Not on iPhone | Glass must be readable without it |

## Testing

- Keyboard only: Tab through every screen.
- Screen readers: VoiceOver (iPhone, Mac), TalkBack (Android).
- axe-core with the `wcag22aa` tag; open menus and dialogs and run it again
  (it skips hidden parts). Lighthouse covers only the automatic checks.
