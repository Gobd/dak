#!/bin/bash
# Simple kiosk setup for Raspberry Pi — orchestrator. Copies remote-setup.sh to the Pi and runs it.
# Usage: bash setup.sh <host> <ssh-user> <ssh-password> <url>
set -e

HOST="${1}"
SSH_USER="${2}"
SSH_PASS="${3}"
URL="${4}"

if [ -z "$HOST" ] || [ -z "$SSH_USER" ] || [ -z "$SSH_PASS" ] || [ -z "$URL" ]; then
  echo "Usage: $0 <host> <ssh-user> <ssh-password> <url>"
  echo "  Example: $0 192.168.1.50 pi raspberry https://example.com"
  exit 1
fi

if ! command -v sshpass &>/dev/null; then
  echo "ERROR: sshpass is required. Install with: brew install sshpass"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCP="sshpass -p ${SSH_PASS} scp -o StrictHostKeyChecking=no"
SSH="sshpass -p ${SSH_PASS} ssh -o StrictHostKeyChecking=no ${SSH_USER}@${HOST}"

echo "==> Granting passwordless sudo to ${SSH_USER}..."
$SSH "echo '${SSH_PASS}' | sudo -S bash -c \"echo '${SSH_USER} ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/${SSH_USER}-nopasswd && chmod 440 /etc/sudoers.d/${SSH_USER}-nopasswd\""

echo "==> Copying scripts to ${HOST}..."
$SCP "${SCRIPT_DIR}/remote-setup.sh" \
     "${SCRIPT_DIR}/kiosk.sh" \
     "${SCRIPT_DIR}/99-kiosk-input.rules" \
     "${SCRIPT_DIR}/bash_profile" \
     "${SCRIPT_DIR}/kiosk-cron" \
     "${SSH_USER}@${HOST}:/tmp/"

echo "==> Running remote-setup.sh on ${HOST}..."
$SSH "sudo bash /tmp/remote-setup.sh '${SSH_USER}' '${URL}' && rm /tmp/remote-setup.sh"

echo "Done. Kiosk will display: ${URL}"
