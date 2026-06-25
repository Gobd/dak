#!/bin/bash
# Runs on the Pi as root. Args: <ssh-user> <url>
set -e

SSH_USER="${1}"
URL="${2}"

echo "==> Updating and upgrading packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing cage, chromium, wlopm, cec-utils, ddcutil..."
apt-get install -y --no-install-recommends cage chromium-browser wlopm cec-utils ddcutil

echo "==> Configuring console autologin..."
raspi-config nonint do_boot_behaviour B2

echo "==> Installing /home/${SSH_USER}/.kiosk.sh..."
sed "s|KIOSK_URL_PLACEHOLDER|${URL}|" /tmp/kiosk.sh > "/home/${SSH_USER}/.kiosk.sh"
chmod +x "/home/${SSH_USER}/.kiosk.sh"
rm /tmp/kiosk.sh

echo "==> Installing udev rule..."
cp /tmp/99-kiosk-input.rules /etc/udev/rules.d/99-kiosk-input.rules
rm /tmp/99-kiosk-input.rules
udevadm control --reload-rules

echo "==> Writing /home/${SSH_USER}/.bash_profile..."
cp /tmp/bash_profile "/home/${SSH_USER}/.bash_profile"
rm /tmp/bash_profile

echo "==> Installing screen on/off cron jobs (7am on, 6pm off, Mountain Time)..."
crontab -u "${SSH_USER}" /tmp/kiosk-cron
rm /tmp/kiosk-cron

echo ""
echo "Done. Rebooting in 5 seconds — Ctrl+C to cancel."
sleep 5
reboot
