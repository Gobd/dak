#!/bin/bash
# Zigbee setup script for climate sensors
# Usage:
#   Local:  bash scripts/zigbee-setup.sh
#   Remote: bash scripts/zigbee-setup.sh <user@host>

set -e

# If remote host provided, run this script there via ssh
if [[ -n "$1" && "$1" != "--"* ]]; then
  REMOTE="$1"
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_DIR="$(dirname "$SCRIPT_DIR")"

  echo "=== Syncing to $REMOTE ==="
  rsync -avz --delete \
    --exclude='.*' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    "$REPO_DIR/scripts/" "$REMOTE:~/dashboard/scripts/"
  rsync -avz --delete \
    --exclude='.*' \
    --exclude='__pycache__' \
    "$REPO_DIR/services/" "$REMOTE:~/dashboard/services/"

  echo "=== Running zigbee setup on $REMOTE ==="
  ssh -t "$REMOTE" "bash ~/dashboard/scripts/zigbee-setup.sh"
  exit 0
fi

# Check for Zigbee dongle
if ! ls /dev/ttyUSB* /dev/ttyACM* &>/dev/null; then
  echo "ERROR: No Zigbee USB dongle detected"
  echo "Plug in your SONOFF Zigbee dongle and try again"
  exit 1
fi

SERIAL_PORT=$(find /dev -maxdepth 1 \( -name 'ttyUSB*' -o -name 'ttyACM*' \) 2>/dev/null | head -1)
echo "=== Found Zigbee dongle at $SERIAL_PORT ==="

echo "=== Installing Mosquitto (MQTT broker) ==="
sudo apt-get update
sudo apt-get install -y mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

echo "=== Installing Node.js 24 for Zigbee2MQTT ==="
if ! command -v node &>/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "=== Installing Zigbee2MQTT ==="
if [ ! -d /opt/zigbee2mqtt ]; then
  sudo mkdir -p /opt/zigbee2mqtt
  sudo chown -R "$USER:$USER" /opt/zigbee2mqtt
  git clone --depth 1 https://github.com/Koenkk/zigbee2mqtt.git /opt/zigbee2mqtt
  cd /opt/zigbee2mqtt && npm ci
fi

mkdir -p /opt/zigbee2mqtt/data
cat > /opt/zigbee2mqtt/data/configuration.yaml << EOF
homeassistant: false
permit_join: false
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://localhost
serial:
  port: $SERIAL_PORT
frontend:
  port: 8080
advanced:
  log_level: warn
  network_key: GENERATE
EOF

sudo usermod -a -G dialout "$USER"

sudo tee /etc/systemd/system/zigbee2mqtt.service > /dev/null << EOF
[Unit]
Description=Zigbee2MQTT
After=network.target mosquitto.service
Requires=mosquitto.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/zigbee2mqtt
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable zigbee2mqtt
sudo systemctl start zigbee2mqtt

echo ""
echo "=== Zigbee setup complete! ==="
echo "Zigbee2MQTT web UI: http://localhost:8080"
echo ""
echo "Next steps:"
echo "1. Open http://$(hostname).local:8080"
echo "2. Click Settings > permit_join: true"
echo "3. Hold sensor button 5s to pair"
echo "4. Rename devices to 'indoor_climate' and 'outdoor_climate'"
echo "5. Disable permit_join when done"
