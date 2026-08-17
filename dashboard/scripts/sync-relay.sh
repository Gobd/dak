#!/bin/bash
# Sync just the home-relay service code to a deployed kiosk and restart it.
# Faster than full deploy.sh when you're only iterating on home-relay itself.
# Usage: ./scripts/sync-relay.sh <user@host> [--no-restart]
# Example: ./scripts/sync-relay.sh kiosk --no-restart

set -e

REMOTE=""
NO_RESTART=""

for arg in "$@"; do
  case $arg in
    --no-restart) NO_RESTART="1" ;;
    -*) echo "Unknown flag: $arg"; exit 1 ;;
    *) REMOTE="$arg" ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 <user@host> [--no-restart]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Syncing home-relay to $REMOTE ==="
rsync -avz --delete \
  --exclude='.*' \
  --exclude='__pycache__' \
  --exclude='.ruff_cache' \
  "$REPO_DIR/services/home-relay/" "$REMOTE:~/dashboard/services/home-relay/"

echo "=== Syncing deps on $REMOTE ==="
ssh -t "$REMOTE" bash -s -- "$NO_RESTART" << 'SYNC_SCRIPT'
set -e
NO_RESTART="$1"

cd ~/dashboard/services/home-relay
~/.local/bin/uv sync

if [[ -z "$NO_RESTART" ]]; then
  echo "=== Restarting home-relay ==="
  sudo systemctl restart --no-block home-relay
  echo "home-relay restarted"
else
  echo "Skipping restart (--no-restart)"
fi
SYNC_SCRIPT

echo "=== Done ==="
