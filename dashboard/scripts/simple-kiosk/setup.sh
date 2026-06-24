#!/bin/bash
# Simple kiosk setup for Raspberry Pi 4 (or similar) — runs remotely over SSH
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

SSH="sshpass -p ${SSH_PASS} ssh -o StrictHostKeyChecking=no ${SSH_USER}@${HOST}"

echo "==> Granting passwordless sudo to ${SSH_USER}..."
$SSH "echo '${SSH_PASS}' | sudo -S bash -c \"echo '${SSH_USER} ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/${SSH_USER}-nopasswd && chmod 440 /etc/sudoers.d/${SSH_USER}-nopasswd\""

echo "==> Updating and upgrading packages on ${HOST}..."
$SSH "sudo apt-get update && sudo apt-get upgrade -y"

echo "==> Installing cage, chromium, and wlopm on ${HOST}..."
$SSH "sudo apt-get install -y --no-install-recommends cage chromium-browser wlopm"

echo "==> Configuring console autologin..."
$SSH "sudo raspi-config nonint do_boot_behaviour B2"

echo "==> Writing ~/.kiosk.sh..."
$SSH "cat > ~/.kiosk.sh" << LAUNCHER
#!/bin/bash
export WLR_LIBINPUT_NO_DEVICES=1
export WLR_NO_HARDWARE_CURSORS=1

# Disable DPMS and screen blanking
xset s off -dpms 2>/dev/null || true

CHROMIUM_BIN=\$(command -v chromium || command -v chromium-browser)
if [ -z "\$CHROMIUM_BIN" ]; then
  echo "ERROR: No chromium binary found" >&2
  exit 1
fi

# Hide cursor unless a real mouse is connected
if grep -qi 'Name=.*mouse' /proc/bus/input/devices 2>/dev/null; then
  CAGE_OPTS=""
else
  CAGE_OPTS="-s"
fi

# URL set by setup.sh — edit this line to change the site
KIOSK_URL="${URL}"

exec cage \$CAGE_OPTS -- "\$CHROMIUM_BIN" \\
  --kiosk \\
  --no-first-run \\
  --disable-translate \\
  --disable-infobars \\
  --noerrdialogs \\
  --disable-session-crashed-bubble \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --ozone-platform=wayland \\
  --disable-wake-on-wifi \\
  "\$KIOSK_URL"
LAUNCHER

$SSH "chmod +x ~/.kiosk.sh"

echo "==> Installing udev rule to ignore vc4 HDMI devices misdetected as input..."
$SSH "sudo tee /etc/udev/rules.d/99-kiosk-input.rules > /dev/null" << 'UDEV'
# Ignore vc4 HDMI devices misdetected as input devices on Raspberry Pi
# Prevents these from triggering cursor rendering in Cage/wlroots
SUBSYSTEM=="input", ATTRS{name}=="vc4-hdmi-0", ENV{LIBINPUT_IGNORE_DEVICE}="1"
SUBSYSTEM=="input", ATTRS{name}=="vc4-hdmi-1", ENV{LIBINPUT_IGNORE_DEVICE}="1"
UDEV
$SSH "sudo udevadm control --reload-rules"

echo "==> Writing ~/.bash_profile..."
$SSH "cat > ~/.bash_profile" << 'PROFILE'
if [ -z "$XDG_RUNTIME_DIR" ]; then
  export XDG_RUNTIME_DIR=/run/user/$(id -u)
fi

if [ -z "$DISPLAY" ] && [ "${XDG_VTNR:-0}" -eq 1 ]; then
  exec ~/.kiosk.sh
fi
PROFILE

echo "==> Installing screen on/off cron jobs (7am on, 6pm off, Mountain Time)..."
$SSH "cat > /tmp/kiosk-cron" << 'CRONEOF'
WAYLAND_DISPLAY=wayland-0
XDG_RUNTIME_DIR=/run/user/1000
# Screen on at 7am
0 7 * * * /usr/bin/wlopm --on '*'
# Screen off at 6pm
0 18 * * * /usr/bin/wlopm --off '*'
CRONEOF
$SSH "crontab /tmp/kiosk-cron && rm /tmp/kiosk-cron"

echo ""
echo "Done. Kiosk will display: ${URL}"
echo "Rebooting ${HOST} in 5 seconds — Ctrl+C to cancel."
sleep 5
$SSH "sudo reboot" || true
