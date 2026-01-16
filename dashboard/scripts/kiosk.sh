#!/bin/bash
# Kiosk startup script - launches Chromium in kiosk mode via Cage compositor

export WLR_LIBINPUT_NO_DEVICES=1

CHROMIUM_BIN=$(command -v chromium || command -v chromium-browser)

if [ -z "$CHROMIUM_BIN" ]; then
  echo "ERROR: No chromium binary found" >&2
  exit 1
fi

exec cage -- "$CHROMIUM_BIN" \
  --kiosk \
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --load-extension=/home/kiosk/.config/chromium-extensions/smartkey \
  --ozone-platform=wayland \
  https://dak.bkemper.me/dashboard
