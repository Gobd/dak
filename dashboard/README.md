# Dashboard

A simple kiosk dashboard with multiple screens. Configure layouts via JSON, navigate with buttons.

**Live:** [dak.bkemper.me/dashboard](https://dak.bkemper.me/dashboard)

## Using the Dashboard

### Editing Layouts

1. **Enter edit mode:** Click the pencil button (bottom-left) or visit `https://dak.bkemper.me/dashboard/?edit`
2. **Move panels:** Drag any panel to reposition (snaps to 5% grid)
3. **Resize panels:** Drag corners or edges
4. **Configure panel:** Double-click a panel to open settings:
   - **URL:** The iframe source (or widget type like `calendar`, `weather`)
   - **Refresh:** Auto-refresh interval (30s, 1m, 5m, 30m, 1h)
   - **Position/Size:** X, Y, Width, Height as percentages
   - **Arguments:** Key-value pairs passed to widgets
5. **Add panel:** Click "Add Panel" in toolbar
6. **Switch screens:** Use arrow buttons to navigate between screens
7. **Exit:** Click "Exit" or remove `?edit` from URL

### Saving & Config Persistence

Your configuration is stored in the browser's localStorage. This means:

- **Survives restarts:** Config persists across browser restarts, system reboots, and power cycles
- **Per-browser:** Each browser/device has its own config
- **Auto-saves:** Changes save automatically when you drag, resize, or edit panels

### Exporting & Importing

**Export your config:**

1. Enter edit mode (`?edit`)
2. Click "Export" in toolbar
3. Downloads `dashboard-config.json` to your computer

**Import a config:**

1. Enter edit mode (`?edit`)
2. Click "Import" in toolbar
3. Select a previously exported JSON file
4. Config loads immediately

**Tip:** Export your config as a backup before making major changes. You can also share configs between devices by exporting from one and importing on another.

### Configuring a Kiosk

On a fullscreen kiosk, you'll need a way to interact for initial setup (touch screen, mouse, or keyboard).

**Option 1: Start kiosk in edit mode**

Change your autostart to load the edit URL directly:

```bash
# In ~/.config/openbox/autostart, change the URL to:
https://dak.bkemper.me/dashboard/?edit
```

Configure via touch screen or mouse, then update autostart back to the normal URL.

**Option 2: Keyboard escape**

Connect a keyboard and press `Alt+F4` to close Chromium, then run it manually:

```bash
chromium https://dak.bkemper.me/dashboard/?edit
```

Reboot when done to return to kiosk mode.

### Resetting to Defaults

Click "Reset" in edit mode to restore the default layout defined in `screens.js`. This clears your localStorage config.

## Widgets

### Calendar (Google Calendar)

The calendar widget displays your Google Calendar events.

**First-time setup:**

1. Add a calendar panel (set URL to `calendar` or use the calendar widget)
2. Click "Sign in with Google" when prompted
3. Authorize the app to read your calendar
4. Events will display automatically

**Authentication:** Sign in once and stay authenticated indefinitely. The widget uses OAuth with refresh tokens - it automatically renews your access in the background without requiring you to sign in again.

**OAuth Setup (for developers):**

In Google Cloud Console, create a Web application OAuth client with these authorized redirect URIs:

```
https://dak.bkemper.me/dashboard/
http://localhost:8080/
```

Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as environment variables in your Cloudflare Pages project settings. The token exchange happens server-side via a Cloudflare Function, so the secret never touches the browser.

**Verify your sign-in is working:**

- If signed in, you'll see your calendar events
- To force re-auth: Open browser DevTools → Application → Local Storage → delete `google-auth` key

### Weather

Displays weather from the National Weather Service API. Configure your location via panel arguments:

- `lat`: Latitude (e.g., `40.7128`)
- `lon`: Longitude (e.g., `-74.0060`)

### Custom iframes

Any URL can be embedded as a panel. Just set the panel URL to your desired webpage.

## Deployment

The dashboard is deployed to Cloudflare Pages with automatic deployments.

### How It Works

1. **Push to `main`** → Deploys to production at [dak.bkemper.me](https://dak.bkemper.me)
2. **Pull requests** → Creates preview deployments automatically
3. **Preview URLs** → Format: `<branch>.dak.pages.dev`

### Initial Setup

**1. Create Cloudflare Pages project:**

```bash
# First time only - creates the project
npx wrangler pages project create dak
```

**2. Add GitHub secrets:**

In your GitHub repo → Settings → Secrets → Actions:

- `CLOUDFLARE_API_TOKEN` - Create at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) with "Edit Cloudflare Pages" permission
- `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare dashboard URL or sidebar

**3. Add Cloudflare environment variables:**

In Cloudflare dashboard → Pages → dak → Settings → Environment variables:

- `GOOGLE_CLIENT_ID` - Your OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Your OAuth client secret

**4. Configure custom domain:**

In Cloudflare dashboard → Pages → dak → Custom domains:

- Add `dak.bkemper.me`

**5. Update DNS:**

In Cloudflare DNS for bkemper.me:

- Add CNAME: `dak` → `dak.pages.dev`

### Local Development

To update default layouts, edit `screens.js` and push. Users can reset to get the new defaults.

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
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  https://dak.bkemper.me/dashboard &
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
