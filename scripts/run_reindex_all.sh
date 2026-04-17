#!/usr/bin/env bash
# run_reindex_all.sh
# Runs the Neon re-indexing script in small batches to avoid OOM.
# Each batch spawns a fresh Node process, keeping heap usage low.

set -e
cd "$(dirname "$0")/.."

BATCH=40
NODE_OPTS="--max-old-space-size=1024"

run_batch() {
  local TYPE=$1
  local OFFSET=$2
  local LIMIT=$3
  echo "--- $TYPE offset=$OFFSET limit=$LIMIT ---"
  NODE_OPTIONS="$NODE_OPTS" npx tsx scripts/reindex_neon.mjs \
    --type "$TYPE" --offset "$OFFSET" --limit "$LIMIT"
}

echo "=== AUTHORS ==="
for OFFSET in 0 40 80 120 160; do
  run_batch authors $OFFSET $BATCH
done

echo ""
echo "=== BOOKS ==="
for OFFSET in 0 40 80 120 160; do
  run_batch books $OFFSET $BATCH
done

echo ""
echo "=== ARTICLES ==="
for OFFSET in 0 40 80 120 160 200 240 280 320 360; do
  run_batch articles $OFFSET $BATCH
done

echo ""
echo "=== All batches complete ==="
