# Local setup

## Install

Use Node.js 24 and npm. The pinned Node major is in `.nvmrc`; the dependency versions are in `package-lock.json`.

```bash
npm ci
cp .env.example .env.local
mkdir -p data
```

Edit `.env.local` locally. Do not paste credentials into issues, screenshots, logs or commits.

## Environment

The table describes the variables consumed by this repository. Provider accounts and permissions must be configured separately.

| Variables                                                               | Used for                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                          | Database connection. The example uses `file:./data/koblip-book.db`.                              |
| `BETTER_AUTH_SECRET`                                                    | Authentication secret; set a private random value of at least 32 characters.                     |
| `BETTER_AUTH_URL`                                                       | App origin. Use `http://localhost:3100` with the command below.                                  |
| `GOOGLE_MAPS_PLATFORM_KEY`                                              | Server-side Places search and business import.                                                   |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Public map display. These browser-visible settings must not contain server credentials.          |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                              | Optional Google login. The callback is `<BETTER_AUTH_URL>/api/auth/callback/google`.             |
| `MODEL_API_KEY`                                                         | Model-backed assistant responses and live speech recognition.                                    |
| `ELEVENLABS_API_KEY`                                                    | Spoken replies. The server creates a short-lived token for the browser.                          |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`        | Email delivery, including verification messages. When absent, sending is skipped with a warning. |
| `UPLOADS_DIR`                                                           | Optional photo storage path; defaults to `./data/uploads`.                                       |
| `SHOWCASE_BUSINESS_SLUG`                                                | Optional business page featured on the home page; the showcase is hidden when empty.             |

Authentication and database access need their settings to work. Configure each provider before testing the feature that uses it. Missing SMTP settings let local development continue, but verification messages will not be delivered.

## Database

For a new local database using the example URL:

```bash
npm run db:migrate
```

The migration configuration defaults to the example local database URL. If you use a different URL, provide `DATABASE_URL` to the migration command through your local environment; the migration configuration does not load `.env.local` itself.

After a schema change, generate a migration with `npm run db:generate` and review it before applying it. Keep local databases and uploads outside Git; the default `data/` directory is ignored.

## Start the app

```bash
PORT=3100 npm run dev
```

Open [localhost:3100](http://localhost:3100). The explicit port matches `BETTER_AUTH_URL` in the example. The custom server reads its port before Next.js loads environment files, so pass `PORT` when starting it.

The app uses `server.mjs` for both HTTP and the live voice WebSocket relay. For a local production build:

```bash
npm run build
PORT=3100 npm start
```

## Validate changes

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Typecheck generates Next.js route types before running TypeScript. The normal test suite uses local fixtures and mocks. Model evaluations in `features/assistant/api/live-eval.test.ts` run only when `RUN_LIVE_EVALS=1`; they require credentials and call an external service. Review that file before enabling them.
