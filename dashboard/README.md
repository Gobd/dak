# Dashboard

A simple kiosk dashboard with multiple screens. Configure layouts via JSON, navigate with swipe or button.

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
  unclutter \
  git \
  curl
```

> **Note:** Package is `chromium` on Debian, `chromium-browser` on Raspberry Pi OS. Adjust if needed.

### 4. Clone dashboard

```bash
cd ~
git clone https://github.com/Gobd/dak.git

# Copy dashboard files to serve location
cp -r ~/dak/dashboard ~/dashboard
```

### 5. Set up dashboard server (systemd)

```bash
sudo tee /etc/systemd/system/dashboard.service > /dev/null << 'EOF'
[Unit]
Description=Dashboard HTTP Server
After=network.target

[Service]
Type=simple
User=kiosk
WorkingDirectory=/home/kiosk/dashboard
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable dashboard
sudo systemctl start dashboard
```

### 6. Configure auto-login

```bash
sudo tee /etc/lightdm/lightdm.conf > /dev/null << 'EOF'
[Seat:*]
autologin-user=kiosk
user-session=openbox
EOF
```

### 7. Create kiosk autostart

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
  --disable-web-security \
  --disable-site-isolation-trials \
  --user-data-dir=/home/kiosk/.chromium-kiosk \
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  http://localhost:8080 &
EOF

chmod +x ~/.config/openbox/autostart
```

> **Note:** Use `chromium-browser` instead of `chromium` on Raspberry Pi OS.

### Security flags explained

The `--disable-web-security` and `--disable-site-isolation-trials` flags are **required for virtual keyboard extensions** to work across iframes from different origins (like embedded widgets, calendars, etc.).

**What these flags disable:**

| Protection | Normal behavior | With flags disabled |
|------------|-----------------|---------------------|
| Same-Origin Policy | JavaScript can only access content from the same domain | JavaScript can access content from ANY domain |
| CORS | Cross-origin fetch/XHR requests are blocked unless server allows | All cross-origin requests succeed |
| iframe isolation | Parent page cannot access cross-origin iframe content | Parent page can read/modify iframe content |

**Why it's needed:**

Browser extensions inject a content script into each frame. Normally, the keyboard in the top frame cannot detect focus or send keystrokes to inputs inside cross-origin iframes (like your weather widget from weatherwidget.io or Google Calendar). These flags allow a single keyboard instance to control inputs across all frames.

**Risk assessment:**

| Scenario | Risk level |
|----------|------------|
| Dedicated kiosk loading only your dashboard | **Low** - you control all content |
| Kiosk with navigation to arbitrary websites | **High** - malicious sites could steal cookies/data from other origins |
| General browsing | **Dangerous** - do not use for normal browsing |

**What's still protected:**
- HTTPS encryption (still works)
- OAuth/login flows (still work - they use redirects, not CORS)
- Cookies (still sent only to their origin, but JS can now read cross-origin DOM)

**If you're uncomfortable with this:** Remove the security flags and each iframe will have its own independent keyboard instance instead of one unified keyboard.

### 8. Reboot

```bash
sudo reboot
```

## Configuration

Edit `screens.js` to configure screens and layouts. The file is self-documenting with comments and ASCII diagrams.

```bash
# On the kiosk:
ssh kiosk@kiosk.local
nano ~/dashboard/screens.js
# Changes take effect on browser refresh (or reboot)
```

## Custom Widgets

For script-based widgets (like WeatherWidget.io), wrap them in a local HTML file. See `widgets/weather.html` for an example, then reference it in `screens.js`:

```javascript
{ src: '/widgets/weather.html', x: '50%', y: '50%', w: '50%', h: '50%' }
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
