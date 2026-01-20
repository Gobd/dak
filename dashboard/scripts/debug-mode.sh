#!/bin/bash
# Swap kiosk to debug mode (non-kiosk Chromium with dev tools)
# Run from SSH, then physically use F12 for dev tools
# To restore: ~/dashboard/scripts/kiosk-mode.sh

cp ~/.kiosk.sh ~/.kiosk.sh.bak

# Write debug browser script
cat > ~/.kiosk.sh << 'EOF'
#!/bin/bash
# Debug mode - Chromium without kiosk flag for dev tools access

# shellcheck source=/dev/null
[ -f ~/.config/dashboard/kiosk.conf ] && source ~/.config/dashboard/kiosk.conf
DASHBOARD_URL="${DASHBOARD_URL:-https://dak.bkemper.me/dashboard}"

export WLR_LIBINPUT_NO_DEVICES=1
CHROMIUM_BIN=$(command -v chromium || command -v chromium-browser)

exec cage -- "$CHROMIUM_BIN" \
  --no-first-run \
  --load-extension=/home/"$USER"/.config/chromium-extensions/smartkey \
  --ozone-platform=wayland \
  "$DASHBOARD_URL"
EOF

chmod +x ~/.kiosk.sh

echo "Swapped to debug mode. Restarting display..."
sudo systemctl restart getty@tty1

echo "Debug mode active. Press F12 on kiosk for dev tools."
echo "To restore: ~/dashboard/scripts/kiosk-mode.sh"
