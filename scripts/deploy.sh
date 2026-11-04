#!/usr/bin/env bash
# Deploys what is on GitHub's main, never this checkout's unpushed work.
#
# The build runs on this machine on purpose: the VPS has one core and 4 GB,
# and a Next.js build there runs out of memory, which took the site down on
# 2026-11-01. The live site is only touched once a checked build is on the
# server; from there scripts/deploy-release.sh takes over (see docs/deploy.md).
#
# Usage: npm run deploy
set -euo pipefail

HOST=koblip-vps
APP=/var/www/koblip-book
WORK=/var/www/koblip-book-deploy
SITE=https://book.koblip.com
BUILD="$HOME/.cache/koblip-book-deploy"
REPO=$(cd "$(dirname "$0")/.." && pwd)

git -C "$REPO" fetch -q origin
SHA=$(git -C "$REPO" rev-parse origin/main)
echo "==> Deploying ${SHA:0:7}"

# One deploy at a time. An interrupted one leaves the lock if this machine
# died before its trap ran.
ssh "$HOST" "mkdir -p $WORK && mkdir $WORK/lock" 2>/dev/null || {
  echo "FAILED: the server can't be reached, or another deploy is running."
  echo "If none is, remove $WORK/lock on the server."
  exit 1
}
HANDED_OVER=false
release_lock() {
  $HANDED_OVER || ssh "$HOST" "rm -rf $WORK/lock" || true
}
trap release_lock EXIT

ssh "$HOST" "set -e
  cd $APP
  git fetch -q origin
  if [ -n \"\$(git status --porcelain)\" ]; then
    echo 'FAILED: the server has local changes:'
    git status --short
    exit 1
  fi
  if ! git merge-base --is-ancestor HEAD $SHA; then
    echo 'FAILED: the server is on a commit that is not part of main.'
    exit 1
  fi
  for key in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS EMAIL_FROM; do
    if ! grep -qE \"^\$key=.+\" .env.production; then
      echo \"FAILED: .env.production has no \$key, so the app can't send email.\"
      exit 1
    fi
  done"
if [ "$(ssh "$HOST" "git -C $APP rev-parse HEAD")" = "$SHA" ]; then
  echo "==> Already live: ${SHA:0:7}"
  exit 0
fi

echo "==> Preparing a clean copy"
mkdir -p "$BUILD"
find "$BUILD" -mindepth 1 -maxdepth 1 \
  ! -name node_modules ! -name .next ! -name .installed-lock -exec rm -rf {} +
git -C "$REPO" archive "$SHA" | tar -x -C "$BUILD"
cd "$BUILD"

# The same Node.js the server runs.
NODE_VERSION=$(ssh "$HOST" "node -v")
NODE_BIN=$(npx -y -p "node@${NODE_VERSION#v}" -- node -p \
  'require("node:path").dirname(process.execPath)')
export PATH="$NODE_BIN:$PATH"

if ! cmp -s package-lock.json .installed-lock; then
  npm ci --no-audit --no-fund
  cp package-lock.json .installed-lock
fi

echo "==> Checking"
npm run lint
npm test

# Only NEXT_PUBLIC_* values are baked into the build, and they come from the
# server's own settings. Every secret stays there: the server reads them when
# it runs. The auth placeholders only keep Better Auth quiet while pages build.
echo "==> Building"
set -a
eval "$(ssh "$HOST" "grep '^NEXT_PUBLIC_' $APP/.env.production")"
set +a
BETTER_AUTH_SECRET=build-only-never-used-when-the-app-runs \
  BETTER_AUTH_URL="$SITE" npx next build

echo "==> Uploading"
STAGE=$(mktemp -d)
COPYFILE_DISABLE=1 tar --no-xattrs --exclude='./.next/cache' \
  -czf "$STAGE/next.tgz" ./.next
du -h "$STAGE/next.tgz" | cut -f1
scp -q "$STAGE/next.tgz" "$HOST:$WORK/next.tgz"
scp -q scripts/deploy-release.sh "$HOST:$WORK/release.sh"
rm -rf "$STAGE"

# Detached, so a dropped connection can't stop it halfway with the site down.
# It owns the lock from here on.
echo "==> Releasing"
ssh "$HOST" "rm -f $WORK/status
  setsid nohup bash $WORK/release.sh $SHA > $WORK/release.log 2>&1 < /dev/null &
  echo \$! > $WORK/release.pid"
HANDED_OVER=true
until ssh "$HOST" "tail -n +1 --pid=\$(cat $WORK/release.pid) -f $WORK/release.log"; do
  echo "    (connection lost; the release keeps running, reconnecting)"
  sleep 5
done
STATUS=$(ssh "$HOST" "cat $WORK/status 2>/dev/null || echo unknown")
if [ "$STATUS" != "live" ]; then
  echo "FAILED: $STATUS"
  exit 1
fi

for path in / /login; do
  code=$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' "$SITE$path")
  echo "    $SITE$path -> $code"
  if [ "$code" != "200" ]; then
    echo "FAILED: the server answers, but $SITE$path returned $code"
    exit 1
  fi
done
echo "==> Live: ${SHA:0:7}"
