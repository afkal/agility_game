#!/usr/bin/env bash
# Build, test and copy the game to the VPS, then restart it.
#
# Usage: DEPLOY_HOST=user@example.org web/deploy/deploy.sh
# Optional: DEPLOY_PATH (default /opt/agility-camp/app),
#           SERVICE (default agility-camp).
#
# The SQLite database lives outside DEPLOY_PATH (see README.md), so a
# deploy never touches saved results.
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST, for example DEPLOY_HOST=user@example.org}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/agility-camp/app}"
SERVICE="${SERVICE:-agility-camp}"

cd "$(dirname "$0")/.."

npm ci
npm run typecheck
npm test
npm run build

rsync -az --delete \
  --exclude='*.test.ts' \
  --exclude='test-support.ts' \
  --include='/dist/' --include='/dist/**' \
  --include='/server/' --include='/server/**' \
  --include='/shared/' --include='/shared/**' \
  --include='/package.json' \
  --include='/package-lock.json' \
  --exclude='*' \
  ./ "$DEPLOY_HOST:$DEPLOY_PATH/"

ssh "$DEPLOY_HOST" "cd '$DEPLOY_PATH' && npm ci --omit=dev && sudo systemctl restart '$SERVICE' && systemctl --no-pager --lines=3 status '$SERVICE'"
