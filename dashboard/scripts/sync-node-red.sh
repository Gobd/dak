#!/bin/bash
# Test and sync only the source-controlled Node-RED application.
# Initial Node-RED installation is handled by deploy.sh.
# Usage: ./scripts/sync-node-red.sh <user@host> [--no-restart]

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
NODE_RED_DIR="$REPO_DIR/services/node-red"

echo "=== Testing Node-RED logic locally ==="
node --test "$NODE_RED_DIR"/test/*.test.js

echo "=== Syncing Node-RED sources to $REMOTE ==="
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.config.*' \
  --exclude='.sessions.json' \
  --exclude='*_cred.json' \
  "$NODE_RED_DIR/" "$REMOTE:~/dashboard/services/node-red/"

echo "=== Validating and activating Node-RED on $REMOTE ==="
ssh -t "$REMOTE" bash -s -- "$NO_RESTART" << 'SYNC_SCRIPT'
set -e
NO_RESTART="$1"
SOURCE_DIR=~/dashboard/services/node-red

if ! command -v node-red > /dev/null; then
  echo "ERROR: Node-RED is not installed; run dashboard/scripts/deploy.sh first"
  exit 1
fi

find "$SOURCE_DIR" -type f -name '*.js' -not -path '*/node_modules/*' \
  -exec node --check {} \;
node --test "$SOURCE_DIR"/test/*.test.js

sed "s|__USER__|$USER|g" "$SOURCE_DIR/node-red.service" \
  | sudo tee /etc/systemd/system/node-red.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable node-red

if [[ -z "$NO_RESTART" ]]; then
  echo "=== Restarting Node-RED ==="
  sudo systemctl restart node-red
  if ! sudo systemctl is-active --quiet node-red; then
    sudo journalctl -u node-red -n 30 --no-pager
    exit 1
  fi
  echo "Node-RED synced and running"
else
  echo "Node-RED synced; restart skipped (--no-restart)"
fi
SYNC_SCRIPT

echo "=== Done ==="
