# Dashboard

A simple kiosk dashboard with multiple screens. Configure layouts via JSON, navigate with buttons.

## Kiosk Setup

### 1. Install OS

<details>
<summary><strong>Raspberry Pi 5</strong></summary>

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose **Raspberry Pi OS Lite (64-bit)** (no desktop)
3. Click the gear icon to pre-configure:
   - Set hostname (e.g., `kiosk`)
   - Enable SSH with password auth
   - Set username/password (e.g., `kiosk` / your password)
   - Configure WiFi if needed
4. Flash to SD card and boot the Pi

</details>

<details>
<summary><strong>x64 (Intel/AMD)</strong></summary>

1. Download [Debian netinst](https://www.debian.org/distrib/netinst) (minimal)
2. Boot from USB and install with:
   - Hostname: `kiosk`
   - Create user: `kiosk`
   - Uncheck all desktop environments (minimal install)
   - Check "SSH server"
3. Reboot into the new install

</details>

### 2. SSH into the box

```bash
ssh kiosk@kiosk.local
# or use IP: ssh kiosk@192.168.x.x
```

### 3. Install system packages

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  xorg \
  chromium \
  openbox \
  lightdm \
  unclutter
```

> **Note:** Package is `chromium` on Debian, `chromium-browser` on Raspberry Pi OS. Adjust if needed.

### 4. Configure auto-login

```bash
sudo tee /etc/lightdm/lightdm.conf > /dev/null << 'EOF'
[Seat:*]
autologin-user=kiosk
user-session=openbox
EOF
```

### 5. Create kiosk autostart

```bash
mkdir -p ~/.config/openbox

tee ~/.config/openbox/autostart > /dev/null << 'EOF'
#!/bin/bash

# Disable screen blanking
xset s off
xset s noblank
xset -dpms

# Hide cursor
unclutter -idle 0.5 -root &

# Launch Chromium kiosk
chromium \
  --kiosk \
  --user-data-dir=/home/kiosk/.chromium-kiosk \
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  https://bkemper.me/dak/dashboard &
EOF

chmod +x ~/.config/openbox/autostart
```

> **Note:** Use `chromium-browser` instead of `chromium` on Raspberry Pi OS.

### 6. Reboot

```bash
sudo reboot
```

## Configuration

Edit `screens.js` to configure screens and layouts. The file is self-documenting with comments and ASCII diagrams. Changes deploy automatically via GitHub Pages.

## Custom Widgets

Add widgets under `widgets/`. Reference them in `screens.js`:

```javascript
{ src: '/widgets/weather/index.html', x: '50%', y: '50%', w: '50%', h: '50%' }
```

## Optional: Automatic Brightness (eyesome)

[eyesome](https://github.com/WinEunuuchs2Unix/eyesome) automatically adjusts screen brightness based on sunrise/sunset.

```bash
# Install dependencies
sudo apt-get install -y bc xdotool xrandr

# Clone and install
git clone https://github.com/WinEunuuchs2Unix/eyesome.git
cd eyesome
sudo ./install.sh

# Configure (sets location for sunrise/sunset times)
eyesome-cfg
```

Test brightness manually:

```bash
# Check your display name
xrandr --listmonitors

# Test brightness (0.5 = 50%, 1.0 = 100%)
xrandr --output HDMI-1 --brightness 0.7
```

> **Note:** Requires X11 (not Wayland). The LightDM + Openbox setup in this guide uses X11, so it works.

## Development

Local testing (no build needed):

```bash
cd dashboard
python3 -m http.server 8080
# Open http://localhost:8080
```
