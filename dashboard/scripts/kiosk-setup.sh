#!/bin/bash
# Kiosk setup script for Raspberry Pi 5 + Raspberry Pi OS Lite
# Uses Wayland + Cage (minimal kiosk compositor)
#
# Copy scripts folder to Pi and run:
#   scp -r scripts kiosk@kiosk.local:~
#   ssh kiosk@kiosk.local
#   bash ~/scripts/kiosk-setup.sh

set -e

echo "=== Installing packages ==="
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  cage \
  ddcutil \
  curl \
  unzip \
  fonts-noto-color-emoji

# Install chromium (package name varies by distro)
if apt-cache show chromium &>/dev/null; then
  sudo apt-get install -y --no-install-recommends chromium
  CHROMIUM_BIN="chromium"
elif apt-cache show chromium-browser &>/dev/null; then
  sudo apt-get install -y --no-install-recommends chromium-browser
  CHROMIUM_BIN="chromium-browser"
else
  echo "ERROR: No chromium package found"
  exit 1
fi
echo "Using: $CHROMIUM_BIN"

# Enable i2c for monitor brightness control
echo "i2c-dev" | sudo tee /etc/modules-load.d/i2c.conf
sudo modprobe i2c-dev 2>/dev/null || true

bash ~/scripts/install-keyboard.sh

echo "=== Configuring Chromium policies ==="
sudo mkdir -p /etc/chromium/policies/managed
sudo tee /etc/chromium/policies/managed/kiosk.json > /dev/null << 'EOF'
{
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "PasswordManagerEnabled": false,
  "AudioCaptureAllowed": true,
  "AudioCaptureAllowedUrls": ["https://dak.bkemper.me"]
}
EOF

echo "=== Adding kiosk user to required groups ==="
sudo usermod -a -G tty,video,i2c kiosk 2>/dev/null || sudo usermod -a -G tty,video kiosk

echo "=== Setting up auto-login and kiosk service ==="
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf > /dev/null << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin kiosk --noclear %I $TERM
EOF

echo "=== Creating kiosk startup script ==="
cat > ~/.kiosk.sh << EOF
#!/bin/bash
export WLR_LIBINPUT_NO_DEVICES=1
exec cage -- $CHROMIUM_BIN \\
  --kiosk \\
  --no-first-run \\
  --disable-translate \\
  --disable-infobars \\
  --noerrdialogs \\
  --disable-session-crashed-bubble \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --load-extension=/home/kiosk/.config/chromium-extensions/smartkey \\
  --ozone-platform=wayland \\
  https://dak.bkemper.me/dashboard
EOF
chmod +x ~/.kiosk.sh

echo "=== Setting up auto-start on login ==="
cat > ~/.bash_profile << 'EOF'
if [ -z "$WAYLAND_DISPLAY" ] && [ "$XDG_VTNR" = "1" ]; then
  exec ~/.kiosk.sh
fi
EOF

echo "=== Setting up auto brightness cron ==="
chmod +x ~/scripts/brightness.sh
# Run on boot and every 2 minutes for smooth gradual transitions
(crontab -l 2>/dev/null | grep -v brightness.sh
 echo "@reboot sleep 30 && /home/kiosk/scripts/brightness.sh auto >> /home/kiosk/brightness.log 2>&1"
 echo "*/2 * * * * /home/kiosk/scripts/brightness.sh auto >> /home/kiosk/brightness.log 2>&1"
) | crontab -

echo "=== Setup complete! ==="
echo "Helper scripts available in ~/scripts/"
echo "Edit ~/scripts/brightness.sh to set LAT/LON for your location"
echo "Rebooting in 5 seconds..."
sleep 5
sudo reboot
