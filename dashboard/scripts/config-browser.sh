#!/bin/bash
# Open chromium in normal mode to configure extensions
# After configuring, run: ~/scripts/restart-kiosk.sh

pkill -f cage 2>/dev/null || true
sleep 1

CHROMIUM_BIN=$(which chromium chromium-browser 2>/dev/null | head -1)

echo "Opening Chromium in normal mode..."
echo "Go to chrome://extensions to configure extensions"
echo "When done, run: ~/scripts/restart-kiosk.sh"

cage -- $CHROMIUM_BIN \
  --no-first-run \
  --load-extension=/home/kiosk/.config/chromium-extensions/smartkey \
  --ozone-platform=wayland \
  chrome://extensions
