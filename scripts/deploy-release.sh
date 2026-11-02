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

# Recreate the entry so PM2 reads the checked-out commit's configuration.
# A failed start may already have deleted it; absence must not block rollback.
start_app() {
  local pid
  # A stopped entry reports 0, a missing one nothing; daemon errors fail.
  pid=$(pm2 pid "$PM2_NAME") || return 1
  if [ -n "$pid" ]; then
    pm2 delete "$PM2_NAME" > /dev/null || return 1
  fi
  if [ -f ecosystem.config.cjs ]; then
    BOOK_PM2_NAME="$PM2_NAME" BOOK_PORT="$PORT" pm2 start ecosystem.config.cjs --only "$PM2_NAME" > /dev/null || return 1
  else
    # The first rollback can return to a commit without the ecosystem file.
    # .env.production has no port or host, and the deleted entry held them.
    PORT="$PORT" HOSTNAME=127.0.0.1 pm2 start npm --name "$PM2_NAME" -- start > /dev/null || return 1
  fi
  wait_until_it_answers || return 1
  pm2 save > /dev/null || return 1
}

# Undoes only what was done, newest first. The app is stopped throughout, so
# restoring the database loses nothing but what a failed start wrote.
roll_back() {
  echo "==> Putting ${OLD:0:7} back"
  local pid
  pid=$(pm2 pid "$PM2_NAME") || return 1
  if [ -n "$pid" ]; then
    pm2 stop "$PM2_NAME" > /dev/null || return 1
  fi
  if $NEXT_SWAPPED; then
    rm -rf .next || return 1
    mv "$WORK/previous/.next" .next || return 1
  fi
  if $MODULES_SWAPPED; then
    rm -rf node_modules || return 1
    mv "$WORK/previous/node_modules" node_modules || return 1
  fi
  if $MIGRATED; then
    cp "$BACKUP" "$DB" || return 1
  fi
  if $MERGED; then
    git reset -q --hard "$OLD" || return 1
  fi
  if start_app; then
    echo "rolled back: ${OLD:0:7} is live"
    return 0
  fi
  echo "ROLLBACK FAILED: could not start, verify or save the PM2 entry on port $PORT"
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
        if answers; then
          status="rollback incomplete; the site answers but restore or PM2 save failed, see $WORK/release.log"
        else
          status="the site is DOWN; rollback failed, see $WORK/release.log"
        fi
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

# Drain running work before switching; an idle app stops at once.
echo "==> Switching"
STOPPED=true
pm2 stop "$PM2_NAME" > /dev/null

BACKUP="$DB.bak-pre-${OLD:0:7}-$(date +%Y%m%d%H%M%S)"
cp "$DB" "$BACKUP"
echo "database backup: $BACKUP"

MERGED=true
git merge -q --ff-only "$SHA"

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

start_app
LIVE=true
echo "==> ${SHA:0:7} is answering on port $PORT"

rm -rf "$WORK/incoming" "$WORK/previous" "$WORK/next.tgz"
