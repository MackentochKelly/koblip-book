<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## About

Koblip Book is a booking app for any local business: customers book appointments on the business's public page, owners manage bookings, services and team.

## Commands

- `npm run dev` — start the dev server
- `npm run typecheck` — typecheck (`tsc --noEmit`)
- `npm run lint` — lint (`eslint`)
- `npm test` — run tests once (`vitest run`)
- `npm run build` — production build

## Structure

- `app/` holds routes only. Route group `app/(public)` = customer pages, `app/(owner)` = owner area.
- `features/<name>/` holds one feature's code (`components`, `hooks`, `api`, `types`, `utils` — only the folders it needs).
- Shared code: `components/ui` (shadcn only, added with `npx shadcn@latest add`), `components/` (shared app parts), `hooks/`, `lib/`, `types/`.
- Import direction: shared → features → app. A feature never imports another feature. No barrel `index.ts` files.
- Each new feature adds its own ESLint zone (see `eslint.config.mjs`).

## UI rules

- Looks and feels like a modern app. Phone first (design at 375px wide, then desktop).
- Owner area: bottom tab bar on phone, sidebar on desktop; panels open as sheets/drawers.
- Touch targets at least 44px. One main action per screen.
- Very little text: short labels, at most one short helper line, anything longer goes in a tooltip; empty state = title + one action.
- Only shadcn components from `components/ui`; build a shared part once in `components/` and reuse it, never a hand-made copy or one-off variant.
- Colours, radius and spacing only from the theme tokens in `app/globals.css`: no hex colours, no arbitrary px values. Check light and dark.

## Working rules

- Read the official docs before anything new or unsure; never guess an API, option or model name.
- Secrets only in `.env.local` and only in server code (use the `server-only` package).
- Small steps. Run typecheck, lint, test and build before saying a task is done.
- Never commit or push; the owner does that.

## Sources

- The bundled Next.js docs (`node_modules/next/dist/docs/`)
- https://nextjs.org/docs
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- https://agents.md
- https://ui.shadcn.com/docs
- https://ai.developer.meta.com/docs/
