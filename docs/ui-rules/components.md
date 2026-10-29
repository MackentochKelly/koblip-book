# Components

Reuse first, install second, build last.

## Order to look in

1. **Our shared parts** in `components/` (e.g. `ViewTabs`, `ResponsivePanel`,
   `BottomPanel`, `PageSection`, `PageNotice`, `VoiceGlobe`,
   `VoiceWaveform`) and feature parts like `ConfirmRemove`.
2. **shadcn** parts in `components/ui` (Base UI flavour, style `base-luma`).
   Missing one: `npx shadcn@latest add <name>`.
3. **A shadcn registry** (installs with the same CLI, lands as our code):
   `npx shadcn@latest add @<registry>/<item>`. Add the registry to
   `components.json` → `registries` first. Browse with
   `npx shadcn@latest search` or the directory at ui.shadcn.com.
4. **Build it** only if nothing above fits, once, in `components/`, from
   shadcn parts and tokens. Then reuse it everywhere.

## Rules

- `components/ui` stays stock shadcn; only `icons.tsx` is ours. Fix the
  call site, not the part. Ask before changing a shared part.
- A registry item is restyled to our tokens, never kept with its own colours.
- "Like X" means X's exact component, not a look-alike.
- One way to do one thing across all screens (one tab row, one confirm,
  one toast, one sheet).

## Registries worth using (checked Oct 2026)

| Registry | Good for | Base UI | Status |
|---|---|---|---|
| shadcn (built-in) | Everything basic, Empty, Skeleton, Spinner, Toast, Drawer | Yes | Active |
| `@coss` (Origin UI) | Full component set | Built on Base UI | Active |
| `@reui` | 1000+ ready patterns | Yes | Active |
| `@diceui` | Accessible advanced parts | Yes | Active |
| `@animate-ui` | Animated primitives | Yes | Active |
| `@ai-elements` (Vercel) | Chat and agent UI | Not confirmed | Active |
| `@elevenlabs-ui` | Voice, orb, waveform | Not confirmed | Active |
| `@magicui` | Animated marketing effects | No primitives | Active |
| `@react-bits` | Visual effects | No primitives | Active (configured) |
| `@aceternity` | Flashy sections | Radix/none | Closed source (configured) |

Prefer Base UI ones. Check a registry item's code before using it: hex
colours, fixed px and missing labels must be fixed to our rules.

## Current state

- Drawer: shadcn's Base UI Drawer (snap points, swipe). Good.
- Toasts: Sonner (works). shadcn now also has a Base UI Toast; pick one
  before writing new toast code, never both.
- shadcn MCP server can browse/install: `npx shadcn@latest mcp init`.
