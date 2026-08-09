#!/bin/bash
# Upgrade Home Assistant Core on a deployed kiosk.
# Rebuilds the venv with a new Python interpreter if the latest homeassistant
# release requires one uv doesn't already have provisioned.
# Usage: ./scripts/upgrade-ha.sh <user@host> [--no-restart]

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

ssh -t "$REMOTE" bash -s -- "$NO_RESTART" << 'UPGRADE_SCRIPT'
set -e
NO_RESTART="$1"
UV=~/.local/bin/uv
VENV=~/homeassistant/.venv

echo "=== Current Home Assistant version ==="
"$VENV/bin/hass" --version || true

REQUIRES_PYTHON="$(curl -s https://pypi.org/pypi/homeassistant/json | jq -r '.info.requires_python // ""')"
echo "=== Latest homeassistant requires-python: ${REQUIRES_PYTHON:-<none specified>} ==="

CURRENT_PY="$("$VENV/bin/python" --version 2>&1 | awk '{print $2}')"
echo "=== Current venv Python: $CURRENT_PY ==="

NEED_REBUILD=""
if [[ -n "$REQUIRES_PYTHON" ]]; then
  if ! "$UV" python find "$REQUIRES_PYTHON" &>/dev/null; then
    NEED_REBUILD="1"
  fi
fi

if [[ -n "$NEED_REBUILD" ]]; then
  echo "=== Current interpreter doesn't satisfy '$REQUIRES_PYTHON' - rebuilding venv ==="

  "$UV" python install "$REQUIRES_PYTHON"

  # Back up the old venv (rather than building the new one at a temp path
  # and renaming it into place) - uv bakes the venv's own path into console
  # script shebangs (e.g. bin/hass) at install time, so the final venv must
  # be built at its permanent path or those shebangs point at a path that
  # no longer exists after a rename.
  BACKUP_VENV=~/homeassistant/.venv.old
  rm -rf "$BACKUP_VENV"
  mv "$VENV" "$BACKUP_VENV"

  if "$UV" venv "$VENV" --python "$REQUIRES_PYTHON" \
    && echo "=== New venv Python: $("$VENV/bin/python" --version) ===" \
    && "$UV" pip install --python "$VENV" homeassistant; then
    rm -rf "$BACKUP_VENV"
  else
    echo "=== Rebuild failed - restoring previous venv ==="
    rm -rf "$VENV"
    mv "$BACKUP_VENV" "$VENV"
    exit 1
  fi
else
  echo "=== Upgrading Home Assistant Core in place ==="
  "$UV" pip install --python "$VENV" --upgrade homeassistant
fi

echo "=== New Home Assistant version ==="
"$VENV/bin/hass" --version

if [[ -z "$NO_RESTART" ]]; then
  echo "=== Restarting Home Assistant ==="
  sudo systemctl restart --no-block home-assistant
  echo "Home Assistant restarted"
else
  echo "Skipping restart (--no-restart)"
fi
UPGRADE_SCRIPT

echo "=== Upgrade complete ==="
