#!/usr/bin/env bash
# From a laptop: bash setup-kiosk-remote.sh user@device 'DISPLAY_URL' [TIMEZONE]
# Uses normal SSH authentication and prompts for sudo if necessary.
set -euo pipefail
TARGET="${1:-}"
URL="${2:-}"
TIMEZONE="${3:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ "$TARGET" != *@* || "$TARGET" == -* || "$TARGET" =~ [[:space:]] || -z "$URL" ]]; then
  echo "Usage: bash $0 user@device 'DISPLAY_URL' [TIMEZONE]" >&2
  exit 1
fi
REMOTE_DIR="$(ssh "$TARGET" 'mktemp -d "$HOME/clock-kiosk-setup.XXXXXX"')"
CLEANUP="$(printf 'rm -rf -- %q' "$REMOTE_DIR")"
trap 'ssh "$TARGET" "$CLEANUP" || true' EXIT
scp "$SCRIPT_DIR/setup-kiosk.sh" "$SCRIPT_DIR/kiosk-launcher.sh" "$TARGET:$REMOTE_DIR/"
# Quote each argument for the remote login shell; the URL is never evaluated as code.
REMOTE_COMMAND="$(printf 'sudo bash %q %q %q' "$REMOTE_DIR/setup-kiosk.sh" "$URL" "$TIMEZONE")"
ssh -t "$TARGET" "$REMOTE_COMMAND"
echo "Setup complete on $TARGET. Reboot it when ready."
