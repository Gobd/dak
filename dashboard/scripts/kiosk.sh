#!/bin/bash
# Kiosk startup script - launches Chromium in kiosk mode via Cage compositor

export WLR_LIBINPUT_NO_DEVICES=1

CHROMIUM_BIN=$(command -v chromium || command -v chromium-browser)

if [ -z "$CHROMIUM_BIN" ]; then
  echo "ERROR: No chromium binary found" >&2
  exit 1
fi

# Hide cursor unless a real mouse is connected
# (real mice have "Mouse" in their name, touchscreens don't)
if grep -qi 'Name=.*mouse' /proc/bus/input/devices 2>/dev/null; then
  CAGE_OPTS=""
else
  CAGE_OPTS="-s"
fi

exec cage $CAGE_OPTS -- "$CHROMIUM_BIN" \
  --kiosk \
  --no-first-run \
  --disk-cache-size=1 \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --load-extension=/home/kiosk/.config/chromium-extensions/smartkey \
  --ozone-platform=wayland \
  https://dak.bkemper.me/dashboard
