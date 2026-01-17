#!/bin/bash
# Kiosk setup script for Raspberry Pi 5 + Raspberry Pi OS Lite
# Uses Wayland + Cage (minimal kiosk compositor)
#
# Copy scripts folder to Pi and run:
#   scp -r scripts kiosk@kiosk.local:~
#   ssh kiosk@kiosk.local
#   bash ~/dashboard/scripts/kiosk-setup.sh

set -e

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

bash ~/dashboard/scripts/install-keyboard.sh

echo "=== Configuring Chromium policies ==="
sudo mkdir -p /etc/chromium/policies/managed
sudo tee /etc/chromium/policies/managed/kiosk.json > /dev/null << 'EOF'
{
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "PasswordManagerEnabled": false,
  "AudioCaptureAllowed": true,
  "AudioCaptureAllowedUrls": ["https://dak.bkemper.me"],
  "InsecurePrivateNetworkRequestsAllowed": true,
  "InsecurePrivateNetworkRequestsAllowedForUrls": ["https://dak.bkemper.me"]
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
echo 'export EDITOR=nano' >> ~/.bashrc

echo "=== Setting up auto brightness cron ==="
chmod +x ~/dashboard/scripts/brightness.sh
# Run on boot and every 2 minutes for smooth gradual transitions
(crontab -l 2>/dev/null | grep -v brightness.sh
 echo "@reboot sleep 30 && /home/kiosk/dashboard/scripts/brightness.sh auto > /dev/null 2>> /home/kiosk/brightness.log"
 echo "*/2 * * * * /home/kiosk/dashboard/scripts/brightness.sh auto > /dev/null 2>> /home/kiosk/brightness.log"
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
