#!/bin/bash
# Clear Chromium browser cache and storage
# Usage: ./scripts/clear-cache.sh [user@host]
#   user@host: optional remote kiosk to clear via SSH
#   If no host specified, runs locally

set -e

REMOTE="$1"

clear_cache() {
  echo "=== Clearing Chromium cache and storage ==="

  # Stop kiosk if running
  if systemctl is-active --quiet cage@kiosk 2>/dev/null; then
    echo "Stopping kiosk service..."
    sudo systemctl stop cage@kiosk || true
  fi

  # Kill any running chromium processes
  pkill -f chromium || true
  pkill -f cage || true
  sleep 1

  # Chromium config directory
  CHROMIUM_DIR="$HOME/.config/chromium/Default"

  if [ -d "$CHROMIUM_DIR" ]; then
    echo "Clearing localStorage..."
    rm -rf "$CHROMIUM_DIR/Local Storage/"

    echo "Clearing sessionStorage..."
    rm -rf "$CHROMIUM_DIR/Session Storage/"

    echo "Clearing IndexedDB..."
    rm -rf "$CHROMIUM_DIR/IndexedDB/"

    echo "Clearing cookies..."
    rm -f "$CHROMIUM_DIR/Cookies"
    rm -f "$CHROMIUM_DIR/Cookies-journal"

    echo "Clearing Service Workers..."
    rm -rf "$CHROMIUM_DIR/Service Worker/"

    echo "Clearing cache..."
    rm -rf "$HOME/.cache/chromium/"
  else
    echo "Chromium directory not found: $CHROMIUM_DIR"
  fi

  echo "Clearing dashboard config..."
  rm -f ~/.config/home-relay/dashboard.json

  echo "=== Cache cleared ==="
  echo "Restarting kiosk..."
  sleep 2
  if sudo systemctl restart getty@tty1; then
    echo "Done"
  else
    echo "Getty restart failed, rebooting..."
    sudo reboot
  fi
}

if [[ -z "$REMOTE" ]]; then
  # Run locally
  clear_cache
else
  # Run remotely via SSH
  echo "=== Clearing cache on $REMOTE ==="
  ssh -t "$REMOTE" "$(declare -f clear_cache); clear_cache"
fi
