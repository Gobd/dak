#!/bin/bash
# Connect a remote Pi to WiFi over SSH (password auth)
# Usage: bash wifi.sh <host> <ssh-user> <ssh-password> <ssid> <wifi-password>
set -e

HOST="${1}"
SSH_USER="${2}"
SSH_PASS="${3}"
SSID="${4}"
WIFI_PASS="${5}"

if [ -z "$HOST" ] || [ -z "$SSH_USER" ] || [ -z "$SSH_PASS" ] || [ -z "$SSID" ] || [ -z "$WIFI_PASS" ]; then
  echo "Usage: $0 <host> <ssh-user> <ssh-password> <ssid> <wifi-password>"
  echo "  Example: $0 192.168.1.50 pi raspberry 'MyWiFi' 'wifipass'"
  exit 1
fi

if ! command -v sshpass &>/dev/null; then
  echo "ERROR: sshpass is required. Install with: brew install sshpass"
  exit 1
fi

SSH="sshpass -p ${SSH_PASS} ssh -o StrictHostKeyChecking=no ${SSH_USER}@${HOST}"

echo "==> Saving WiFi profile for: ${SSID} (WPA2)..."
$SSH "sudo nmcli con delete '${SSID}' 2>/dev/null || true"
$SSH "sudo nmcli con add type wifi con-name '${SSID}' ssid '${SSID}' wifi-sec.key-mgmt wpa-psk wifi-sec.psk '${WIFI_PASS}'"

echo "==> Verifying profile was saved..."
$SSH "nmcli con show | grep '${SSID}'"

echo ""
echo "Done. ${HOST} will auto-connect to '${SSID}' when in range."
