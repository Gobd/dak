#!/bin/bash
# Kiosk setup script for Raspberry Pi 5 + Raspberry Pi OS Lite
#
# Copy scripts folder to Pi and run:
#   scp -r scripts kiosk@kiosk.local:~
#   ssh kiosk@kiosk.local
#   bash ~/scripts/kiosk-setup.sh

set -e

echo "=== Installing packages ==="
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  xserver-xorg \
  lightdm \
  openbox \
  unclutter \
  unzip \
  wget \
  ddcutil \
  curl

# Enable i2c for monitor brightness control
echo "i2c-dev" | sudo tee /etc/modules-load.d/i2c.conf
sudo modprobe i2c-dev

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

echo "=== Installing virtual keyboard extension ==="
mkdir -p ~/.config/chromium-extensions
wget -O /tmp/smartkey.zip https://github.com/Gobd/chrome-virtual-keyboard/releases/download/v3.0.1/smartkey-v3.0.1.zip
unzip -o /tmp/smartkey.zip -d ~/.config/chromium-extensions/
rm /tmp/smartkey.zip

echo "=== Adding kiosk user to required groups ==="
sudo usermod -a -G tty,video kiosk

echo "=== Setting graphical boot target ==="
sudo systemctl set-default graphical.target

echo "=== Configuring X for Pi 5 ==="
sudo mkdir -p /etc/X11/xorg.conf.d
sudo tee /etc/X11/xorg.conf.d/99-pi.conf > /dev/null << 'EOF'
Section "Device"
    Identifier "default"
    Driver "modesetting"
    Option "kmsdev" "/dev/dri/card1"
EndSection
EOF

echo "=== Configuring lightdm ==="
sudo tee /etc/lightdm/lightdm.conf > /dev/null << 'EOF'
[Seat:*]
autologin-user=kiosk
autologin-session=openbox
xserver-command=X -s 0 -dpms
EOF

echo "=== Creating openbox autostart ==="
mkdir -p ~/.config/openbox
cat > ~/.config/openbox/autostart << EOF
#!/bin/bash
export DISPLAY=:0
sleep 2
xset s off
xset s noblank
xset -dpms
unclutter -idle 0.5 -root &
$CHROMIUM_BIN \\
  --kiosk \\
  --no-first-run \\
  --disable-translate \\
  --disable-infobars \\
  --noerrdialogs \\
  --disable-session-crashed-bubble \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --load-extension=/home/kiosk/.config/chromium-extensions/smartkey \\
  https://dak.bkemper.me/dashboard &
EOF
chmod +x ~/.config/openbox/autostart

echo "=== Setting up auto brightness cron ==="
chmod +x ~/scripts/brightness.sh
(crontab -l 2>/dev/null | grep -v brightness.sh; echo "*/15 * * * * /home/kiosk/scripts/brightness.sh auto >> /home/kiosk/brightness.log 2>&1") | crontab -

echo "=== Setup complete! ==="
echo "Helper scripts available in ~/scripts/"
echo "Edit ~/scripts/brightness.sh to set LAT/LON for your location"
echo "Rebooting in 5 seconds..."
sleep 5
sudo reboot
