#!/usr/bin/env bash
# Runs on the server, started by scripts/deploy.sh once the build is uploaded:
# puts one commit live. Nothing live changes until every slow or risky part is
# ready, and any failure after that puts the previous version back.
#
# Usage: release.sh <commit>
set -euo pipefail

SHA=$1
APP=${BOOK_APP:-/var/www/koblip-book}
WORK=${BOOK_WORK:-/var/www/koblip-book-deploy}
PM2_NAME=${BOOK_PM2_NAME:-koblip-book}
PORT=${BOOK_PORT:-3100}
# How long the new version gets to answer, in seconds.
START_LIMIT=60

cd "$APP"
OLD=$(git rev-parse HEAD)
STOPPED=false MERGED=false MODULES_SWAPPED=false NEXT_SWAPPED=false
MIGRATED=false LIVE=false
DB=""
BACKUP=""

answers() {
  for path in / /login; do
    [ "$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' \
      "http://127.0.0.1:$PORT$path")" = "200" ] || return 1
  done
}

wait_until_it_answers() {
  for _ in $(seq 1 "$START_LIMIT"); do
    answers && return 0
    sleep 1
  done
  return 1
}

# Undoes only what was done, newest first. The app is stopped throughout, so
# restoring the database loses nothing but what a failed start wrote.
roll_back() {
  echo "==> Putting ${OLD:0:7} back"
  pm2 stop "$PM2_NAME" > /dev/null || true
  if $NEXT_SWAPPED; then
    rm -rf .next
    mv "$WORK/previous/.next" .next
  fi
  if $MODULES_SWAPPED; then
    rm -rf node_modules
    mv "$WORK/previous/node_modules" node_modules
  fi
  if $MIGRATED; then
    cp "$BACKUP" "$DB"
  fi
  if $MERGED; then
    git reset -q --hard "$OLD"
  fi
  pm2 restart "$PM2_NAME" --update-env > /dev/null
  if wait_until_it_answers; then
    echo "rolled back: ${OLD:0:7} is live"
    return 0
  fi
  echo "ROLLBACK FAILED: nothing answers on port $PORT"
  return 1
}

finish() {
  local code=$?
  trap - EXIT
  local status="live"
  if ! $LIVE; then
    status="stopped before touching the live site; ${OLD:0:7} is still live"
    if $STOPPED; then
      if roll_back; then
        status="rolled back; ${OLD:0:7} is live"
      else
        status="the site is DOWN; rollback failed, see $WORK/release.log"
      fi
    fi
  fi
  echo "$status" > "$WORK/status"
  rm -rf "$WORK/lock"
  exit "$code"
}
trap finish EXIT

set -a
# shellcheck disable=SC1091
. ./.env.production
set +a
DB=${DATABASE_URL#file:}

# Ready everything first, with the live site still running.
git cat-file -e "$SHA"
rm -rf "$WORK/incoming" "$WORK/previous"
mkdir -p "$WORK/incoming" "$WORK/previous"
tar --no-same-owner -xzf "$WORK/next.tgz" -C "$WORK/incoming"
[ -s "$WORK/incoming/.next/BUILD_ID" ]

NEW_MODULES=false
if ! git diff --quiet "$OLD" "$SHA" -- package-lock.json; then
  echo "==> Installing packages"
  mkdir -p "$WORK/incoming/deps"
  git show "$SHA:package.json" > "$WORK/incoming/deps/package.json"
  git show "$SHA:package-lock.json" > "$WORK/incoming/deps/package-lock.json"
  (cd "$WORK/incoming/deps" && npm ci --no-audit --no-fund)
  NEW_MODULES=true
fi

# Optimized images and fetched data stay valid across versions.
mkdir -p "$WORK/incoming/.next/cache"
for part in images fetch-cache; do
  if [ -d ".next/cache/$part" ]; then
    cp -al ".next/cache/$part" "$WORK/incoming/.next/cache/$part"
  fi
done

# The site is down from here until the new version answers: seconds.
echo "==> Switching"
pm2 stop "$PM2_NAME" > /dev/null
STOPPED=true

BACKUP="$DB.bak-pre-${OLD:0:7}-$(date +%Y%m%d%H%M%S)"
cp "$DB" "$BACKUP"
echo "database backup: $BACKUP"

git merge -q --ff-only "$SHA"
MERGED=true

if $NEW_MODULES; then
  mv node_modules "$WORK/previous/node_modules"
  MODULES_SWAPPED=true
  mv "$WORK/incoming/deps/node_modules" node_modules
fi

if ! git diff --quiet "$OLD" "$SHA" -- drizzle; then
  echo "==> Migrating"
  MIGRATED=true
  npm run db:migrate
fi

mv .next "$WORK/previous/.next"
NEXT_SWAPPED=true
mv "$WORK/incoming/.next" .next

pm2 restart "$PM2_NAME" --update-env > /dev/null
wait_until_it_answers
LIVE=true
echo "==> ${SHA:0:7} is answering on port $PORT"

rm -rf "$WORK/incoming" "$WORK/previous" "$WORK/next.tgz"
