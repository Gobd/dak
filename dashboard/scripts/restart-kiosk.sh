#!/bin/bash
# Restart chromium kiosk (after alt+f4)

CHROMIUM_BIN=$(which chromium chromium-browser 2>/dev/null | head -1)

DISPLAY=:0 $CHROMIUM_BIN \
  --kiosk \
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --load-extension=/home/kiosk/.config/chromium-extensions/smartkey \
  https://dak.bkemper.me/dashboard &
