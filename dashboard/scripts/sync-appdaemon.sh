#!/bin/bash
# Test and sync only the source-controlled AppDaemon application.
# Initial AppDaemon installation is handled by deploy.sh.
# Usage: ./scripts/sync-appdaemon.sh <user@host> [--no-restart]

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
APPDAEMON_DIR="$REPO_DIR/services/appdaemon"

echo "=== Testing AppDaemon logic locally ==="
python3 -m unittest discover "$APPDAEMON_DIR/tests"

echo "=== Syncing AppDaemon sources to $REMOTE ==="
rsync -avz --delete --exclude='__pycache__' \
  "$APPDAEMON_DIR/" "$REMOTE:~/dashboard/services/appdaemon/"

echo "=== Validating and activating AppDaemon on $REMOTE ==="
ssh -t "$REMOTE" bash -s -- "$NO_RESTART" << 'SYNC_SCRIPT'
set -e
NO_RESTART="$1"
SOURCE_DIR=~/dashboard/services/appdaemon

if [ ! -x ~/appdaemon/.venv/bin/appdaemon ]; then
  echo "ERROR: AppDaemon is not installed; run dashboard/scripts/deploy.sh first"
  exit 1
fi

~/appdaemon/.venv/bin/python -m unittest discover "$SOURCE_DIR/tests"
sed "s|__USER__|$USER|g" "$SOURCE_DIR/appdaemon.service" \
  | sudo tee /etc/systemd/system/appdaemon.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable appdaemon

if [[ -z "$NO_RESTART" ]]; then
  echo "=== Restarting AppDaemon ==="
  sudo systemctl restart appdaemon
  if ! sudo systemctl is-active --quiet appdaemon; then
    sudo journalctl -u appdaemon -n 50 --no-pager
    exit 1
  fi
  echo "AppDaemon synced and running"
else
  echo "AppDaemon synced; app files will hot reload"
fi
SYNC_SCRIPT

echo "=== Done ==="
