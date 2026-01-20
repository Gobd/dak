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
ssh "$REMOTE" "command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh"
ssh "$REMOTE" "cd ~/dashboard/services/home-relay && ~/.local/bin/uv sync"

if [[ "$SKIP_SETUP" == "true" ]]; then
  echo "=== Updating services ==="
  ssh "$REMOTE" "sed \"s|__USER__|\$USER|g\" ~/dashboard/services/home-relay/home-relay.service | sudo tee /etc/systemd/system/home-relay.service > /dev/null && \
    sed \"s|__USER__|\$USER|g\" ~/dashboard/services/home-relay/voice-control.service | sudo tee /etc/systemd/system/voice-control.service > /dev/null && \
    sed \"s|__USER__|\$USER|g\" ~/dashboard/services/zigbee2mqtt/zigbee2mqtt.service | sudo tee /etc/systemd/system/zigbee2mqtt.service > /dev/null && \
    sudo systemctl daemon-reload"
else
  echo "=== Running setup ==="
  ssh -t "$REMOTE" "bash ~/dashboard/scripts/kiosk-setup.sh"
fi

echo "=== Restarting services ==="
ssh "$REMOTE" "sudo systemctl restart home-relay voice-control zigbee2mqtt 2>/dev/null || true"
echo "=== Deploy complete ==="
