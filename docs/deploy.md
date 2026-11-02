# Deploying Book

```bash
npm run deploy
```

This puts GitHub's `main` live on book.koblip.com. Push first: work that is only on your machine is not deployed.

Never run `npm run build` on the server. It has one core and 4 GB of memory, and a build there runs out of memory. A failed build also deletes the running version, which took the site down on 2026-11-01.

## What it does

On your machine ([scripts/deploy.sh](../scripts/deploy.sh)):

1. Takes a lock, so only one deploy runs at a time.
2. Stops if the server has local changes or is on a commit that is not part of `main`.
3. Exports a clean copy of `main` to `~/.cache/koblip-book-deploy`, so uncommitted work can't ship.
4. Runs lint, tests and the production build, which includes the type check, with the server's Node.js version.
5. Uploads the build to the server. The live site has not been touched yet.

On the server ([scripts/deploy-release.sh](../scripts/deploy-release.sh)), detached, so a dropped connection can't stop it halfway:

1. Unpacks the build and installs changed packages in a separate folder, with the site still running.
2. Stops the app and backs up the database next to it (`.bak-pre-<commit>-<time>`).
3. Moves the code to the new commit, swaps in the packages, runs new migrations and swaps in the build.
4. Starts the app and waits for `/` and `/login` to answer.

The site is down only during steps 2–4. That takes seconds, plus the time for any migrations.

## If something fails

- **Before the app stops:** the live site was never touched. Fix the problem and deploy again.
- **After the app stops:** the previous commit, packages, build and database come back automatically, and the script says `rolled back`.
- **`the site is DOWN`:** the rollback failed too. Read `/var/www/koblip-book-deploy/release.log` on the server.
- **`another deploy is running`:** if none is, remove `/var/www/koblip-book-deploy/lock` on the server.

To undo a release that works but behaves badly, revert the commit on `main` and deploy again. A migration that already ran stays, so restore the database from its backup if the older code needs that.

## Settings

Secrets stay in `.env.production` on the server, and the app reads them when it runs. Only `NEXT_PUBLIC_*` values are baked into the build. The script reads those from the server's file, so changing one needs a new deploy.
