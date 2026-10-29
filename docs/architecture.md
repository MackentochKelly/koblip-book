# Architecture

Koblip Book uses the Next.js App Router, with feature code separated from route entry points. Tests are colocated with the code they exercise.

## Code boundaries

| Location                                  | Responsibility                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `app/`                                    | Pages, layouts, route handlers and global styles. `(public)` contains customer routes; `(owner)` contains owner routes. |
| `features/<feature>/`                     | Feature components, hooks, API operations, types, utilities and translations as needed.                                 |
| `components/`, `hooks/`, `lib/`, `types/` | Reusable building blocks shared by features and routes.                                                                 |
| `components/ui/`                          | Shared shadcn UI primitives.                                                                                            |
| `lib/db/`                                 | Database connection and schema, including authentication tables.                                                        |
| `drizzle/`                                | Versioned database migrations.                                                                                          |
| `server/`                                 | Live voice relay and its tests.                                                                                         |
| `scripts/`                                | Explicit maintenance and import operations.                                                                             |

Routes may compose features and shared code. Features may use shared code. Shared code must not depend on features, and one feature must not import another. ESLint zones enforce feature boundaries; new features need their own zone. Avoid barrel `index.ts` exports.

## Runtime

`server.mjs` starts Next.js and handles WebSocket upgrades on the same port. Use the repository's `dev` and `start` scripts so the voice relay is available alongside normal routes.

Database access uses Drizzle with the libSQL client. A local SQLite file is the default development configuration. Better Auth handles owner sessions and optional Google login. Server modules that access private credentials use `server-only`.

The owner assistant uses server-side model calls and tools. Live voice recognition passes through the server relay. Spoken replies use a token minted by a server route, allowing the browser to connect to the speech service without receiving the long-lived API key. See the [assistant plan](assistant-plan.md) for the design history and stream contract; verify current behavior in the implementation.

## Interface and language

Shared styles and theme tokens live in `app/globals.css`. Shared messages live in `lib/i18n.ts`; features also hold their own translations. Interface changes must pass the [UI checklist](ui-rules/checklist.md), including phone and desktop layouts, English and Spanish, and light and dark themes.

## Verification

Vitest covers API operations, business rules, utilities and selected components. CI performs a clean dependency install, route type generation and typecheck, lint, tests and a production build. Live model evaluations are opt-in and separate from normal checks.
