#!/bin/bash
# Deploy dashboard to kiosk and run setup
# Usage: ./scripts/deploy.sh <user@host> [--no-setup] [--restart]
#   --no-setup: skip running kiosk-setup.sh (just sync files)
#   --restart: restart home-relay service after sync

set -e

REMOTE=""
SKIP_SETUP=false
RESTART=false

for arg in "$@"; do
  case $arg in
    --no-setup) SKIP_SETUP=true ;;
    --restart) RESTART=true ;;
    *) REMOTE="$arg" ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 <user@host> [--no-setup] [--restart]"
  echo "  --no-setup: skip running kiosk-setup.sh (just sync files)"
  echo "  --restart: restart home-relay service after sync"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Syncing to $REMOTE ==="
rsync -avz --delete \
  --include='scripts/***' \
  --include='services/***' \
  --exclude='*' \
  "$REPO_DIR/" "$REMOTE:~/dashboard/"

if [[ "$SKIP_SETUP" == "true" ]]; then
  echo "=== Syncing Python dependencies ==="
  ssh "$REMOTE" "cd ~/dashboard/services/home-relay && ~/.local/bin/uv sync"
  echo "=== Sync complete (setup skipped) ==="
else
  echo "=== Running setup ==="
  ssh -t "$REMOTE" "bash ~/dashboard/scripts/kiosk-setup.sh"
fi

if [[ "$RESTART" == "true" ]]; then
  echo "=== Restarting home-relay service ==="
  ssh "$REMOTE" "sudo systemctl restart home-relay"
  echo "=== Service restarted ==="
fi
