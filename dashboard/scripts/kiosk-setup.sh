#!/bin/bash
# Kiosk setup script for Raspberry Pi 5 + Raspberry Pi OS Lite
# Uses Wayland + Cage (minimal kiosk compositor)
#
# Usage:
#   Local:  bash scripts/kiosk-setup.sh
#   Remote: bash scripts/kiosk-setup.sh user@host
#
# For self-hosting, create ~/.config/dashboard/kiosk.conf before running:
#   DASHBOARD_URL=https://yourdomain.com/dashboard

set -e

# Remote execution support
if [[ -n "$1" && "$1" == *"@"* ]]; then
  REMOTE="$1"
  echo "=== Running kiosk-setup on $REMOTE ==="

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_DIR="$(dirname "$SCRIPT_DIR")"

  # Sync files first
  rsync -avz --delete \
    --exclude='.*' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --include='scripts/***' \
    --include='services/***' \
    --exclude='*' \
    "$REPO_DIR/" "$REMOTE:~/dashboard/"

  # Run this script remotely (without the remote arg)
  ssh -t "$REMOTE" "bash ~/dashboard/scripts/kiosk-setup.sh"
  exit 0
fi

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
  git \
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
sed "s|__DASHBOARD_ORIGIN__|$DASHBOARD_ORIGIN|g" \
  ~/dashboard/scripts/chromium-kiosk.json \
  | sudo tee /etc/chromium/policies/managed/kiosk.json > /dev/null

echo "=== Adding kiosk user to required groups ==="
sudo usermod -a -G tty,video,i2c kiosk 2>/dev/null || sudo usermod -a -G tty,video kiosk

echo "=== Setting up auto-login and kiosk service ==="
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo cp ~/dashboard/scripts/autologin.conf /etc/systemd/system/getty@tty1.service.d/

echo "=== Installing kiosk startup script ==="
cp ~/dashboard/scripts/kiosk.sh ~/.kiosk.sh
chmod +x ~/.kiosk.sh

echo "=== Setting up auto-start on login ==="
cp ~/dashboard/scripts/bash_profile ~/.bash_profile

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

# =============================================================================
# ZIGBEE SETUP (for climate sensors)
# =============================================================================
echo "=== Setting up Zigbee (climate sensors) ==="

echo "Installing Mosquitto (MQTT broker)..."
sudo apt-get install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

echo "Installing Node.js 24 for Zigbee2MQTT..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Installing Zigbee2MQTT..."
if [ ! -d /opt/zigbee2mqtt ]; then
  sudo mkdir -p /opt/zigbee2mqtt
  sudo chown -R "$USER:$USER" /opt/zigbee2mqtt
  git clone --depth 1 https://github.com/Koenkk/zigbee2mqtt.git /opt/zigbee2mqtt
  cd /opt/zigbee2mqtt && npm ci
fi

# Detect serial port or use default
SERIAL_PORT=$(find /dev -maxdepth 1 \( -name 'ttyUSB*' -o -name 'ttyACM*' \) 2>/dev/null | head -1)
SERIAL_PORT="${SERIAL_PORT:-/dev/ttyUSB0}"

# Copy and configure zigbee2mqtt config
mkdir -p /opt/zigbee2mqtt/data
sed "s|__SERIAL_PORT__|$SERIAL_PORT|g" \
  ~/dashboard/services/zigbee2mqtt/configuration.yaml \
  > /opt/zigbee2mqtt/data/configuration.yaml

sudo usermod -a -G dialout "$USER"

# Copy and configure systemd service
sed "s|__USER__|$USER|g" \
  ~/dashboard/services/zigbee2mqtt/zigbee2mqtt.service \
  | sudo tee /etc/systemd/system/zigbee2mqtt.service > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable zigbee2mqtt

if ls /dev/ttyUSB* /dev/ttyACM* &>/dev/null; then
  echo "Zigbee dongle detected at $SERIAL_PORT - starting service"
  sudo systemctl start zigbee2mqtt
  echo "Zigbee2MQTT running. Web UI at http://localhost:8080"
else
  echo "No Zigbee dongle detected - service will start when plugged in"
fi

# =============================================================================
# VOICE CONTROL SETUP
# =============================================================================
echo "=== Setting up voice control ==="
if [ -d ~/dashboard/services/home-relay ]; then
  echo "Installing voice dependencies..."
  sudo apt-get install -y portaudio19-dev python3-pyaudio alsa-utils sox

  cd ~/dashboard/services/home-relay
  uv sync --group voice

  # Create directories (models/voices downloaded via Settings UI)
  mkdir -p ~/dashboard/services/home-relay/models
  mkdir -p ~/dashboard/services/home-relay/voices
  mkdir -p ~/dashboard/services/home-relay/piper

  echo "Creating feedback sounds..."
  SOUNDS_DIR=~/dashboard/services/home-relay/sounds
  mkdir -p "$SOUNDS_DIR"
  if command -v sox &>/dev/null; then
    sox -n "$SOUNDS_DIR/wake.wav" synth 0.1 sine 800:1200 vol 0.5 2>/dev/null || true
    sox -n "$SOUNDS_DIR/success.wav" synth 0.15 sine 1000 vol 0.5 2>/dev/null || true
    sox -n "$SOUNDS_DIR/error.wav" synth 0.2 sine 300 vol 0.5 2>/dev/null || true
  fi

  echo "Testing audio input..."
  if arecord -d 2 -f S16_LE -r 16000 -c 1 /tmp/test_audio.wav 2>/dev/null; then
    echo "Microphone test successful"
    rm -f /tmp/test_audio.wav
  else
    echo "Warning: Microphone test failed (voice may not work)"
  fi

  echo "Installing voice control service..."
  sudo usermod -a -G audio "$USER"
  sudo cp ~/dashboard/services/home-relay/voice-control.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable voice-control
  sudo systemctl start voice-control
  echo "Voice control installed."
  echo "  1. Enable in Settings > Voice Control"
  echo "  2. Download a speech model"
  echo "  3. (Optional) Download a TTS voice for spoken responses"
else
  echo "Skipping voice control (services/home-relay not found)"
fi

echo "=== Setup complete! ==="
echo ""
echo "Services installed:"
echo "  - Home relay (Kasa, WoL, brightness)"
echo "  - Voice control (enable in Settings > Voice Control)"
echo "  - Zigbee2MQTT (starts when USB dongle plugged in)"
echo ""
if ls /dev/ttyUSB* /dev/ttyACM* &>/dev/null; then
  echo "Zigbee dongle detected! After reboot:"
  echo "  1. Open http://$(hostname).home.arpa:8080"
  echo "  2. Enable permit_join in Settings"
  echo "  3. Hold sensor button 5s to pair"
  echo "  4. Name devices 'indoor_climate' and 'outdoor_climate'"
else
  echo "No Zigbee dongle detected."
  echo "To add climate sensors later: plug in dongle and reboot."
fi
echo ""
echo "Rebooting in 5 seconds..."
sleep 5
sudo reboot
