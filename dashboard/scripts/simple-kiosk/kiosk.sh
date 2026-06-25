#!/bin/bash
export WLR_LIBINPUT_NO_DEVICES=1
export WLR_NO_HARDWARE_CURSORS=1

xset s off -dpms 2>/dev/null || true

CHROMIUM_BIN=$(command -v chromium || command -v chromium-browser)
if [ -z "$CHROMIUM_BIN" ]; then
  echo "ERROR: No chromium binary found" >&2
  exit 1
fi

if grep -qi 'Name=.*mouse' /proc/bus/input/devices 2>/dev/null; then
  CAGE_OPTS=""
else
  CAGE_OPTS="-s"
fi

# URL set by setup.sh — edit this line to change the site
KIOSK_URL="KIOSK_URL_PLACEHOLDER"

exec cage $CAGE_OPTS -- "$CHROMIUM_BIN" \
  --kiosk \
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --ozone-platform=wayland \
  --disable-wake-on-wifi \
  "$KIOSK_URL"
