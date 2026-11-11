# Deploying Book

```bash
npm run deploy
```

Only the owner decides when to deploy: never run this unless the owner says so in chat.

This puts GitHub's `main` live on book.koblip.com. Push first: work that is only on your machine is not deployed.

Never run `npm run build` on the server. It has one core and 4 GB of memory, and a build there runs out of memory. A failed build also deletes the running version, which took the site down on 2026-11-01.

## What it does

On your machine ([scripts/deploy.sh](../scripts/deploy.sh)):

1. Takes a lock, so only one deploy runs at a time.
2. Stops if the server has local changes, is on a commit that is not part of `main`, or has no email settings in `.env.production`.
3. Exports a clean copy of `main` to `~/.cache/koblip-book-deploy`, so uncommitted work can't ship.
4. Runs lint, tests and the production build, which includes the type check, with the server's Node.js version.
5. Uploads the build to the server. The live site has not been touched yet.

On the server ([scripts/deploy-release.sh](../scripts/deploy-release.sh)), detached, so a dropped connection can't stop it halfway:

1. Unpacks the build and installs changed packages in a separate folder, with the site still running.
2. Stops the app and backs up the database next to it (`.bak-pre-<commit>-<time>`).
3. Moves the code to the new commit, swaps in the packages, runs new migrations and swaps in the build.
4. Recreates the PM2 entry from `ecosystem.config.cjs`, waits for `/` and `/login` to answer, then saves PM2's process list.

The site is down only during steps 2–4. That takes seconds when idle, plus the time for any migrations, and up to about 30 s more when running work needs to finish. Stopping waits for requests and `after()` work; the server exits after at most 28 s, before PM2's 30 s forced kill. The first deploy with this change still stops the old process the old way; the new drain applies once this version is running.

## If something fails

- **Before the app stops:** the live site was never touched. Fix the problem and deploy again.
- **After the app stops:** the previous commit, packages, build and database come back automatically, and the script says `rolled back`.
- **`the site is DOWN`:** the rollback failed too. Read `/var/www/koblip-book-deploy/release.log` on the server.
- **`rollback incomplete`:** the site answers, but restoring files or saving PM2 failed. Read the same release log before deploying again.
- **`another deploy is running`:** if none is, remove `/var/www/koblip-book-deploy/lock` on the server.

To undo a release that works but behaves badly, revert the commit on `main` and deploy again. A migration that already ran stays, so restore the database from its backup if the older code needs that.

## Settings

The app's PM2 setup lives in [ecosystem.config.cjs](../ecosystem.config.cjs): one fork instance, running `server.mjs` directly. `BOOK_PM2_NAME` still overrides the app name: the release script passes it when PM2 reads the file. Rollback uses the restored commit's file, or starts through `npm start` if that older commit has none.

Secrets stay in `.env.production` on the server, and the app reads them when it runs. Only `NEXT_PUBLIC_*` values are baked into the build. The script reads those from the server's file, so changing one needs a new deploy.

Email goes through Amazon SES's API ([Email](email.md)). `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `EMAIL_FROM` live in `.env.production`; the deploy stops without them. `AWS_REGION` is the region where `koblip.com` is verified (`us-east-1`), and `EMAIL_FROM` is `"Koblip <contact@koblip.com>"`. `SES_CONFIGURATION_SET` and `SES_EVENTS_TOPIC_ARN` bring bounces and complaints back to `/api/email/events`. A quoted value is required when it has spaces, because the release script sources this file. The old `SMTP_*` values are no longer read.
