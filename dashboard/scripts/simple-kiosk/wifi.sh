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

echo "==> Connecting ${HOST} to WiFi: ${SSID}..."
$SSH "sudo nmcli dev wifi connect '${SSID}' password '${WIFI_PASS}'"

echo "==> Verifying connection..."
$SSH "nmcli -t -f NAME,STATE con show --active"

echo ""
echo "Done. ${HOST} should now be on '${SSID}'."
