#!/bin/bash
# Kiosk setup script for Raspberry Pi 5 + Raspberry Pi OS Lite
# Uses Wayland + Cage (minimal kiosk compositor)
#
# Copy scripts folder to Pi and run:
#   scp -r scripts kiosk@kiosk.home.arpa:~
#   ssh kiosk@kiosk.home.arpa
#   bash ~/dashboard/scripts/kiosk-setup.sh
#
# For self-hosting, create ~/.config/dashboard/kiosk.conf before running:
#   DASHBOARD_URL=https://yourdomain.com/dashboard

set -e

# Copy config from scripts folder if not already present
mkdir -p ~/.config/dashboard
if [ -f ~/dashboard/scripts/kiosk.conf ] && [ ! -f ~/.config/dashboard/kiosk.conf ]; then
  cp ~/dashboard/scripts/kiosk.conf ~/.config/dashboard/kiosk.conf
fi
# shellcheck source=/dev/null
[ -f ~/.config/dashboard/kiosk.conf ] && source ~/.config/dashboard/kiosk.conf

DASHBOARD_URL="${DASHBOARD_URL:-https://dak.bkemper.me/dashboard}"
# Extract origin from URL for Chromium policies
DASHBOARD_ORIGIN="${DASHBOARD_URL%%/dashboard*}"

echo "=== Updating and upgrading system ==="
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get full-upgrade -y

echo "=== Installing packages ==="
sudo apt-get install -y --no-install-recommends \
  cage \
  ddcutil \
  curl \
  unzip \
  jq \
  fonts-noto-color-emoji \
  fonts-noto-core

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

# Fix Chromium config that adds empty --load-extension flag when /usr/share/chromium/extensions doesn't exist
if [ -f /etc/chromium.d/extensions ]; then
  sudo sed -i '/--load-extension=/d' /etc/chromium.d/extensions
fi

# Enable i2c for monitor brightness control
echo "i2c-dev" | sudo tee /etc/modules-load.d/i2c.conf
sudo modprobe i2c-dev 2>/dev/null || true

bash ~/dashboard/scripts/install-keyboard.sh || echo "Warning: install-keyboard.sh failed (continuing)"

echo "=== Configuring Chromium policies ==="
sudo mkdir -p /etc/chromium/policies/managed
sudo tee /etc/chromium/policies/managed/kiosk.json > /dev/null << EOF
{
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "PasswordManagerEnabled": false,
  "AudioCaptureAllowed": true,
  "AudioCaptureAllowedUrls": ["$DASHBOARD_ORIGIN"],
  "InsecurePrivateNetworkRequestsAllowed": true,
  "InsecurePrivateNetworkRequestsAllowedForUrls": ["$DASHBOARD_ORIGIN"],
  "LocalNetworkAccessAllowedForUrls": ["$DASHBOARD_ORIGIN"]
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

echo "=== Installing kiosk startup script ==="
cp ~/dashboard/scripts/kiosk.sh ~/.kiosk.sh
chmod +x ~/.kiosk.sh

echo "=== Setting up auto-start on login ==="
cat > ~/.bash_profile << 'EOF'
if [ -z "$WAYLAND_DISPLAY" ] && [ "$XDG_VTNR" = "1" ]; then
  exec ~/.kiosk.sh
fi
EOF

echo "=== Setting nano as default editor ==="
grep -q 'EDITOR=nano' ~/.bashrc || echo 'export EDITOR=nano' >> ~/.bashrc

echo "=== Setting up auto brightness cron ==="
chmod +x ~/dashboard/scripts/brightness.sh
# Run every 2 minutes via API (home-relay handles the logic)
(crontab -l 2>/dev/null | grep -v brightness || true
 echo "@reboot sleep 30 && curl -s http://localhost:5111/brightness/auto > /dev/null"
 echo "*/2 * * * * curl -s http://localhost:5111/brightness/auto > /dev/null"
) | crontab -

echo "=== Setting up home-relay service (Kasa + WOL) ==="
if [ -d ~/dashboard/services/home-relay ]; then
  # Install uv if not present
  if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi

  cd ~/dashboard/services/home-relay
  uv sync

  # Install and enable systemd service
  sudo cp home-relay.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable home-relay
  sudo systemctl start home-relay
  echo "Home relay service installed and started"
else
  echo "Skipping home-relay (services/home-relay not found)"
fi

echo "=== Setup complete! ==="
echo "Helper scripts available in ~/dashboard/scripts/"
echo "Configure auto-brightness via the dashboard UI (brightness widget)"
echo "Rebooting in 5 seconds..."
sleep 5
sudo reboot
