#!/usr/bin/env bash
# Run ON the device: sudo bash setup-kiosk.sh 'DISPLAY_URL' [TIMEZONE] [KIOSK_USER]
# Target: Debian-based Orange Pi / Armbian image with working DRM/KMS display drivers.
set -euo pipefail

URL="${1:-}"
TIMEZONE="${2:-}"
KIOSK_USER="${3:-${SUDO_USER:-}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

fail() { echo "ERROR: $*" >&2; exit 1; }
[[ "$EUID" -eq 0 ]] || fail 'Run using sudo.'
case "$URL" in http://*|https://*) ;; *) fail "Usage: sudo bash $0 'HTTP(S)_URL' [TIMEZONE] [KIOSK_USER]" ;; esac
[[ ! "$URL" =~ [[:space:]] ]] || fail 'URL must not contain whitespace; use the encoded Copy display URL.'
[[ -n "$KIOSK_USER" && "$KIOSK_USER" != root ]] || fail 'Supply a non-root kiosk user (or run via sudo as that user).'
[[ "$KIOSK_USER" =~ ^[a-z_][a-z0-9_-]*\$?$ ]] || fail 'Invalid kiosk username.'
id "$KIOSK_USER" >/dev/null 2>&1 || fail 'Kiosk user does not exist.'
[[ "$(id -u "$KIOSK_USER")" -ne 0 ]] || fail 'Chromium must not run as root.'
command -v apt-get >/dev/null || fail 'Use a Debian-based image with apt.'
[[ -d /run/systemd/system ]] || fail 'This setup requires a booted systemd-based image.'
[[ -f "$SCRIPT_DIR/kiosk-launcher.sh" ]] || fail 'Copy kiosk-launcher.sh alongside this script.'

HOME_DIR="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
LOGIN_SHELL="$(getent passwd "$KIOSK_USER" | cut -d: -f7)"
[[ "$LOGIN_SHELL" == */bash ]] || fail 'Use a Bash-login kiosk user (chsh -s /bin/bash USER).'
GROUP="$(id -gn "$KIOSK_USER")"
if [[ -n "$TIMEZONE" ]]; then
  timedatectl set-timezone "$TIMEZONE"
fi

echo '==> Installing Cage, native Chromium, and Mesa...'
apt-get update
if apt-cache policy chromium | grep -q 'Candidate: (none)'; then
  fail 'This image has no native Chromium package. Use a supported Debian/Armbian Debian image, not a Snap-only Ubuntu image.'
fi
apt-get install -y --no-install-recommends cage chromium dbus-user-session libgl1-mesa-dri

# Preserve existing chrony/NTP installations; otherwise enable timesyncd.
if systemctl is-active --quiet chrony.service || systemctl is-active --quiet chronyd.service || systemctl is-active --quiet ntp.service || systemctl is-active --quiet ntpsec.service; then
  echo '==> Existing NTP service is active; keeping it.'
else
  echo '==> Enabling automatic time synchronization...'
  apt-get install -y --no-install-recommends systemd-timesyncd
  systemctl enable --now systemd-timesyncd.service
  timedatectl set-ntp true
fi

for group in video render input; do
  if getent group "$group" >/dev/null; then usermod -aG "$group" "$KIOSK_USER"; fi
done

CONFIG_DIR="$HOME_DIR/.config/clock-kiosk"
install -d -m 700 -o "$KIOSK_USER" -g "$GROUP" "$CONFIG_DIR"
# Treat the URL as data. No sed substitution, sourcing, or eval of its contents.
printf '%s\n' "$URL" > "$CONFIG_DIR/url"
chown "$KIOSK_USER:$GROUP" "$CONFIG_DIR/url"
chmod 600 "$CONFIG_DIR/url"
install -d -m 755 -o "$KIOSK_USER" -g "$GROUP" "$HOME_DIR/.local/bin"
install -m 755 -o "$KIOSK_USER" -g "$GROUP" "$SCRIPT_DIR/kiosk-launcher.sh" "$HOME_DIR/.local/bin/clock-kiosk"

PROFILE="$HOME_DIR/.bash_profile"
if [[ ! -f "$PROFILE" ]]; then
  # HOME must expand at the user's login, not during this root installation.
  # shellcheck disable=SC2016
  printf '%s\n' 'if [ -f "$HOME/.profile" ]; then . "$HOME/.profile"; fi' > "$PROFILE"
fi
# Replace only our managed block; preserve unrelated login/SSH customization.
TEMP_PROFILE="$(mktemp)"
trap 'rm -f "$TEMP_PROFILE"' EXIT
awk '
  /^# BEGIN DAK CLOCK KIOSK$/ { skip=1; next }
  /^# END DAK CLOCK KIOSK$/ { skip=0; next }
  !skip { print }
' "$PROFILE" > "$TEMP_PROFILE"
cat >> "$TEMP_PROFILE" <<'PROFILE_BLOCK'
# BEGIN DAK CLOCK KIOSK
if [ -z "${SSH_CONNECTION:-}" ] && [ -z "${DISPLAY:-}" ] && [ "${XDG_VTNR:-0}" = 1 ]; then
  exec "$HOME/.local/bin/clock-kiosk"
fi
# END DAK CLOCK KIOSK
PROFILE_BLOCK
install -m 644 -o "$KIOSK_USER" -g "$GROUP" "$TEMP_PROFILE" "$PROFILE"

install -d /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/clock-kiosk.conf <<GETTY_UNIT
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I linux
GETTY_UNIT
systemctl daemon-reload
systemctl enable getty@tty1.service
systemctl set-default multi-user.target

echo ''
echo 'Clock kiosk installed. No reboot has been performed.'
echo 'Reboot when ready: sudo reboot'
echo "URL is stored privately at $CONFIG_DIR/url (not printed)."
echo "Timezone: $(timedatectl show --property=Timezone --value)"
echo 'Inspect synchronization with: timedatectl status'
echo 'Display resolution/rotation and board boot files were not modified.'
echo 'If your image lacks a working GPU renderer, see the renderer fallback in clock/scripts/README.md.'
