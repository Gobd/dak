#!/bin/bash
# Deploy dashboard to kiosk and run setup
# Usage: ./scripts/deploy.sh <user@host> [--no-restart]

set -e

REMOTE=""
NO_RESTART=""

for arg in "$@"; do
  case $arg in
    --no-restart) NO_RESTART="1" ;;
    -*) echo "Unknown flag: $arg"; exit 1 ;;
    *) REMOTE="$arg" ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 <user@host> [--no-restart]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Syncing to $REMOTE ==="
rsync -avz --delete \
  --exclude='.*' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --include='scripts/***' \
  --include='services/***' \
  --exclude='*' \
  "$REPO_DIR/" "$REMOTE:~/dashboard/"

echo "=== Running setup on $REMOTE ==="
ssh -t "$REMOTE" bash -s -- "$NO_RESTART" << 'SETUP_SCRIPT'
set -e
NO_RESTART="$1"

# Copy config from scripts folder if not already present
mkdir -p ~/.config/dashboard
if [ -f ~/dashboard/scripts/config/kiosk.conf ] && [ ! -f ~/.config/dashboard/kiosk.conf ]; then
  cp ~/dashboard/scripts/config/kiosk.conf ~/.config/dashboard/kiosk.conf
fi
# shellcheck source=/dev/null
[ -f ~/.config/dashboard/kiosk.conf ] && source ~/.config/dashboard/kiosk.conf

DASHBOARD_URL="${DASHBOARD_URL:-https://dak.bkemper.me/dashboard}"
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
elif apt-cache show chromium-browser &>/dev/null; then
  sudo apt-get install -y --no-install-recommends chromium-browser
else
  echo "ERROR: No chromium package found"
  exit 1
fi

# Fix Chromium config that adds empty --load-extension flag
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
  ~/dashboard/scripts/config/chromium-kiosk.json \
  | sudo tee /etc/chromium/policies/managed/kiosk.json > /dev/null

echo "=== Adding kiosk user to required groups ==="
sudo usermod -a -G tty,video,i2c kiosk 2>/dev/null || sudo usermod -a -G tty,video kiosk

echo "=== Setting up auto-login and kiosk service ==="
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo cp ~/dashboard/scripts/config/autologin.conf /etc/systemd/system/getty@tty1.service.d/

echo "=== Installing kiosk startup script ==="
cp ~/dashboard/scripts/config/kiosk-launcher.sh ~/.kiosk.sh
chmod +x ~/.kiosk.sh

echo "=== Setting up auto-start on login ==="
cp ~/dashboard/scripts/config/bash_profile ~/.bash_profile

echo "=== Setting nano as default editor ==="
grep -q 'EDITOR=nano' ~/.bashrc || echo 'export EDITOR=nano' >> ~/.bashrc

echo "=== Setting up auto brightness cron ==="
chmod +x ~/dashboard/scripts/brightness.sh
(crontab -l 2>/dev/null | grep -v brightness || true
 echo "@reboot sleep 30 && (curl -sf http://localhost:5111/brightness/auto || ddcutil setvcp 10 100)"
 echo "*/2 * * * * curl -s http://localhost:5111/brightness/auto > /dev/null"
) | crontab -

echo "=== Setting up home-relay service ==="
if [ -d ~/dashboard/services/home-relay ]; then
  if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi

  cd ~/dashboard/services/home-relay
  ~/.local/bin/uv sync

  sed "s|__USER__|$USER|g" home-relay.service | sudo tee /etc/systemd/system/home-relay.service > /dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable home-relay
  if [[ -z "$NO_RESTART" ]]; then
    sudo systemctl restart --no-block home-relay
    echo "Home relay service installed and restarted"
  else
    echo "Home relay service installed (hot reload will pick up changes)"
  fi
fi

# =============================================================================
# ZIGBEE SETUP
# =============================================================================
echo "=== Setting up Zigbee ==="

echo "Installing Mosquitto..."
sudo apt-get install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
if [[ -z "$NO_RESTART" ]]; then
  sudo systemctl start --no-block mosquitto
fi

echo "Installing Node.js 24..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

ZIGBEE2MQTT_VERSION="2.7.2"
echo "Installing Zigbee2MQTT $ZIGBEE2MQTT_VERSION..."
sudo mkdir -p /opt/zigbee2mqtt
sudo chown -R "$USER:$USER" /opt/zigbee2mqtt
curl -Lo /tmp/zigbee2mqtt.tar.gz "https://github.com/Koenkk/zigbee2mqtt/archive/refs/tags/${ZIGBEE2MQTT_VERSION}.tar.gz"
tar -xzf /tmp/zigbee2mqtt.tar.gz -C /opt/zigbee2mqtt --strip-components=1
rm /tmp/zigbee2mqtt.tar.gz
cd /opt/zigbee2mqtt && sudo corepack enable pnpm && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile

# Preserve existing Zigbee2MQTT data (paired devices, network key, etc.)
# To start fresh: sudo rm -rf /opt/zigbee2mqtt/data && sudo systemctl restart zigbee2mqtt
if [ -d /opt/zigbee2mqtt/data ] && [ -f /opt/zigbee2mqtt/data/database.db ]; then
  echo "Preserving existing Zigbee2MQTT data (paired devices)"
else
  mkdir -p /opt/zigbee2mqtt/data
  cp ~/dashboard/services/zigbee2mqtt/configuration.yaml /opt/zigbee2mqtt/data/configuration.yaml
fi

sudo usermod -a -G dialout "$USER"

sudo cp ~/dashboard/services/zigbee2mqtt/99-zigbee.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules

sed "s|__USER__|$USER|g" ~/dashboard/services/zigbee2mqtt/zigbee2mqtt.service \
  | sudo tee /etc/systemd/system/zigbee2mqtt.service > /dev/null

sudo systemctl daemon-reload
if [[ -z "$NO_RESTART" ]]; then
  sudo systemctl start --no-block zigbee2mqtt || true
fi

# =============================================================================
# VOICE CONTROL SETUP
# =============================================================================
echo "=== Setting up voice control ==="
if [ -d ~/dashboard/services/home-relay ]; then
  sudo apt-get install -y portaudio19-dev python3-pyaudio alsa-utils sox

  cd ~/dashboard/services/home-relay
  ~/.local/bin/uv sync --group voice

  mkdir -p ~/dashboard/services/home-relay/models
  mkdir -p ~/dashboard/services/home-relay/voices
  mkdir -p ~/dashboard/services/home-relay/piper

  SOUNDS_DIR=~/dashboard/services/home-relay/sounds
  mkdir -p "$SOUNDS_DIR"
  if command -v sox &>/dev/null; then
    sox -n "$SOUNDS_DIR/wake.wav" synth 0.1 sine 800:1200 vol 0.5 2>/dev/null || true
    sox -n "$SOUNDS_DIR/success.wav" synth 0.15 sine 1000 vol 0.5 2>/dev/null || true
    sox -n "$SOUNDS_DIR/error.wav" synth 0.2 sine 300 vol 0.5 2>/dev/null || true
  fi

  sudo usermod -a -G audio "$USER"
  sed "s|__USER__|$USER|g" ~/dashboard/services/home-relay/voice-control.service \
    | sudo tee /etc/systemd/system/voice-control.service > /dev/null
  sudo systemctl daemon-reload
fi

echo "=== Setup complete! ==="
echo ""
echo "Services installed:"
echo "  - Home relay (Kasa, WoL, brightness)"
echo "  - Voice control (enable in Settings)"
echo "  - Zigbee2MQTT (starts when USB dongle plugged in)"

if [[ -z "$NO_RESTART" ]]; then
  echo "Rebooting in 5 seconds..."
  sleep 5
  sudo reboot
else
  echo "Skipping reboot (--no-restart)"
fi
SETUP_SCRIPT

echo "=== Deploy complete ==="
