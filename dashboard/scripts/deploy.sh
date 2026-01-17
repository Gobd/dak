#!/bin/bash
# Deploy dashboard to kiosk and run setup
# Usage: ./scripts/deploy.sh <user@host> [--no-setup]
#   --no-setup: skip running kiosk-setup.sh (just sync files)

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
  echo "  --no-setup: skip running kiosk-setup.sh (just sync files)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Syncing to $REMOTE ==="
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.log' \
  "$REPO_DIR/" "$REMOTE:~/dashboard/"

if [[ "$SKIP_SETUP" == "true" ]]; then
  echo "=== Sync complete (setup skipped) ==="
else
  echo "=== Running setup ==="
  ssh -t "$REMOTE" "bash ~/dashboard/scripts/kiosk-setup.sh"
fi
