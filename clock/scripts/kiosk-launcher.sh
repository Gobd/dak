#!/usr/bin/env bash
# Runs as the console-autologin user. Configuration is data, never sourced/eval'd.
set -euo pipefail

CONFIG_DIR="${HOME}/.config/clock-kiosk"
IFS= read -r KIOSK_URL < "${CONFIG_DIR}/url"
case "$KIOSK_URL" in
  http://*|https://*) ;;
  *) echo 'Clock kiosk URL must use HTTP(S).' >&2; exit 1 ;;
esac

export WLR_LIBINPUT_NO_DEVICES=1
export WLR_NO_HARDWARE_CURSORS=1
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Optional fallback for images without a working Mesa/DRM renderer.
if [[ -f "${CONFIG_DIR}/renderer" ]]; then
  IFS= read -r renderer < "${CONFIG_DIR}/renderer"
  case "$renderer" in
    pixman|gles2) export WLR_RENDERER="$renderer" ;;
    auto|'') ;;
    *) echo 'Renderer must be auto, pixman, or gles2.' >&2; exit 1 ;;
  esac
fi

CHROMIUM_BIN="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROMIUM_BIN" ]]; then
  echo 'Chromium is not installed.' >&2
  exit 1
fi

exec cage -s -- "$CHROMIUM_BIN" \
  --kiosk \
  --incognito \
  --user-data-dir="${HOME}/.cache/clock-kiosk/chromium" \
  --disk-cache-size=16777216 \
  --media-cache-size=16777216 \
  --no-first-run \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --disable-extensions \
  --disable-background-networking \
  --overscroll-history-navigation=0 \
  --ozone-platform=wayland \
  "$KIOSK_URL"
