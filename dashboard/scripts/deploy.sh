#!/bin/bash
# Deploy dashboard to kiosk and run setup
# Usage: ./scripts/deploy.sh <user@host> [--no-setup]
#   --no-setup: skip running kiosk-setup.sh (just sync files + restart)

set -e

REMOTE=""
SKIP_SETUP=false

for arg in "$@"; do
  case $arg in
    --no-setup) SKIP_SETUP=true ;;
    *) REMOTE="$arg" ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 <user@host> [--no-setup]"
  echo "  --no-setup: skip running kiosk-setup.sh (just sync files + restart)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Syncing to $REMOTE ==="
rsync -avz --delete \
  --exclude='.*' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --include='scripts/***' \
  --include='services/***' \
  --exclude='*' \
  "$REPO_DIR/" "$REMOTE:~/dashboard/"

echo "=== Syncing Python dependencies ==="
ssh "$REMOTE" "cd ~/dashboard/services/home-relay && ~/.local/bin/uv sync"

if [[ "$SKIP_SETUP" == "true" ]]; then
  echo "=== Sync complete (setup skipped) ==="
else
  echo "=== Running setup ==="
  ssh -t "$REMOTE" "bash ~/dashboard/scripts/kiosk-setup.sh"
fi

echo "=== Restarting home-relay service ==="
ssh "$REMOTE" "sudo systemctl restart home-relay"
echo "=== Deploy complete ==="
