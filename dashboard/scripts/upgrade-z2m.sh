#!/bin/bash
# Upgrade Zigbee2MQTT to a specific version on a deployed kiosk.
# Usage: ./scripts/upgrade-z2m.sh <user@host> <version> [--no-restart]
# Example: ./scripts/upgrade-z2m.sh kiosk 2.13.0

set -e

REMOTE=""
VERSION=""
NO_RESTART=""

for arg in "$@"; do
  case $arg in
    --no-restart) NO_RESTART="1" ;;
    -*) echo "Unknown flag: $arg"; exit 1 ;;
    *)
      if [[ -z "$REMOTE" ]]; then
        REMOTE="$arg"
      elif [[ -z "$VERSION" ]]; then
        VERSION="$arg"
      fi
      ;;
  esac
done

if [[ -z "$REMOTE" || -z "$VERSION" ]]; then
  echo "Usage: $0 <user@host> <version> [--no-restart]"
  echo "Example: $0 kiosk 2.13.0"
  exit 1
fi

ssh -t "$REMOTE" bash -s -- "$VERSION" "$NO_RESTART" << 'UPGRADE_SCRIPT'
set -e
VERSION="$1"
NO_RESTART="$2"

echo "=== Current Zigbee2MQTT version ==="
cd /opt/zigbee2mqtt && npm run --silent version 2>/dev/null || jq -r '.version' package.json

echo "=== Stopping Zigbee2MQTT ==="
sudo systemctl stop zigbee2mqtt

echo "=== Downloading Zigbee2MQTT $VERSION ==="
curl -Lo /tmp/zigbee2mqtt.tar.gz "https://github.com/Koenkk/zigbee2mqtt/archive/refs/tags/${VERSION}.tar.gz"

echo "=== Extracting (preserving data/) ==="
TMP_EXTRACT="/tmp/zigbee2mqtt-${VERSION}"
rm -rf "$TMP_EXTRACT"
mkdir -p "$TMP_EXTRACT"
tar -xzf /tmp/zigbee2mqtt.tar.gz -C "$TMP_EXTRACT" --strip-components=1
rm /tmp/zigbee2mqtt.tar.gz

rsync -a --delete --exclude='data' "$TMP_EXTRACT/" /opt/zigbee2mqtt/
rm -rf "$TMP_EXTRACT"

echo "=== Installing dependencies ==="
cd /opt/zigbee2mqtt && sudo corepack enable pnpm && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile

echo "=== New Zigbee2MQTT version ==="
jq -r '.version' /opt/zigbee2mqtt/package.json

if [[ -z "$NO_RESTART" ]]; then
  echo "=== Restarting Zigbee2MQTT ==="
  sudo systemctl start zigbee2mqtt
  echo "Zigbee2MQTT restarted"
else
  echo "Skipping restart (--no-restart)"
fi
UPGRADE_SCRIPT

echo "=== Upgrade complete ==="
