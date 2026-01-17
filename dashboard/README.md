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

Your configuration is stored on disk via the home-relay API (`~/.config/home-relay/dashboard.json`), with localStorage as a fallback:

- **Survives restarts:** Config persists across browser restarts, system reboots, and power cycles
- **Editable via SSH:** Edit the JSON file directly at `~/.config/home-relay/dashboard.json`
- **Auto-saves:** Changes save automatically when you drag, resize, or edit panels
- **Fallback:** If the API is unavailable, config is saved to localStorage

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

**Option 3: Remote editing from your laptop**

Edit the kiosk layout from any device on your network:

```
https://dak.bkemper.me/dashboard/?edit&relay=kiosk.local:5111
```

Replace `kiosk.local` with your kiosk's IP if hostname doesn't resolve. The `relay` parameter tells the dashboard to save config to the kiosk's home-relay API instead of localhost.

When you save changes, the kiosk automatically reloads via SSE (Server-Sent Events).

### Resetting to Defaults

Click "Reset" in edit mode to restore the default layout from `config/dashboard.json`. This clears both the API config and localStorage.

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

Displays weather from the National Weather Service API. Click the gear icon to configure your location via city name, state, or ZIP code.

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

To update default layouts, edit `config/dashboard.json` and push. Users can reset to get the new defaults.

## Kiosk Setup (Raspberry Pi 5)

Uses Wayland + Cage (minimal kiosk compositor) for a lightweight, modern setup.

### 1. Flash OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose **Raspberry Pi OS Lite (64-bit)** (no desktop)
3. Click gear icon to configure:
   - Hostname: `kiosk`
   - Enable SSH (use public key auth for convenience)
   - Username: `kiosk`, set password
   - WiFi if needed
4. Flash to SD card and boot

### 2. Run setup script

```bash
# From dashboard folder on your Mac:
./scripts/deploy.sh kiosk@kiosk.local

# Or just sync files without running setup:
./scripts/deploy.sh kiosk@kiosk.local --no-setup
```

> **Note:** Replace `kiosk.local` with the Pi's IP address if hostname doesn't resolve.

> **Reimaged your Pi?** If you get "REMOTE HOST IDENTIFICATION HAS CHANGED", clear the old SSH key:
>
> ```bash
> ssh-keygen -R kiosk.local   # or the IP address
> ```

The Pi reboots and launches the dashboard in kiosk mode.

### Helper scripts

After setup, these are available in `~/scripts/`:

- `restart-kiosk.sh` - Restart kiosk after closing
- `config-browser.sh` - Open browser in normal mode to configure extensions
- `brightness.sh` - Manual brightness control (day/night/set N/status)

### Keyboard shortcuts

- `Ctrl+Alt+F2` - Switch to terminal (login as kiosk)
- `Ctrl+Alt+F1` - Back to kiosk

### Troubleshooting & Logs

**Home-relay service (Kasa, WoL, config API):**

```bash
# View logs
journalctl -u home-relay -f

# Check status
sudo systemctl status home-relay

# Restart service
sudo systemctl restart home-relay
```

**Brightness cron job:**

```bash
# View cron logs
grep CRON /var/log/syslog | tail -20

# Test manually
~/scripts/brightness.sh status
~/scripts/brightness.sh auto
```

**Check config file:**

```bash
cat ~/.config/home-relay/dashboard.json | jq .
```

## Configuration

Edit `config/dashboard.json` to configure default screens and layouts. See `config/README.md` for field documentation. Changes deploy automatically via GitHub Pages.

On the kiosk, config is stored at `~/.config/home-relay/dashboard.json` and can be edited via SSH.

## Custom Widgets

Add widgets under `widgets/`. Reference them in `config/dashboard.json`:

```json
{ "type": "iframe", "src": "/widgets/weather/index.html", "x": "50%", "y": "50%", "w": "50%", "h": "50%" }
```

## Automatic Brightness

The setup script installs automatic brightness control using `ddcutil`. It adjusts monitor brightness based on sunrise/sunset with smooth transitions.

**Configure via dashboard UI:**

1. Click the brightness widget settings (sun icon)
2. Enable auto-brightness
3. Search and select your location
4. Adjust day/night brightness levels and transition time

**Manual control:**

```bash
~/scripts/brightness.sh day      # Set day brightness
~/scripts/brightness.sh night    # Set night brightness
~/scripts/brightness.sh set 50   # Set to 50%
~/scripts/brightness.sh status   # Show current level
```

> **Note:** Requires a monitor that supports DDC/CI. Most modern monitors do. The script exits gracefully if not configured.

## Development

Local testing (no build needed):

```bash
cd dashboard
python3 -m http.server 8080
# Open http://localhost:8080
```

## Security Considerations

The home-relay service is designed for **trusted home networks only**:

- **No authentication**: The API endpoints (`/config`, `/kasa/*`, `/wol/*`, `/brightness/*`) have no auth. Anyone on your LAN can read/write config and control devices.
- **CORS allows any origin**: Required for the dashboard to work from different hosts (GitHub Pages, local dev, remote editing).
- **Config stored in plaintext**: `~/.config/home-relay/dashboard.json` is readable by any local process.

**This is acceptable because:**
- The kiosk is on a private home network behind a firewall
- Only trusted devices are on the LAN
- The controlled devices (Kasa plugs, WoL targets) are low-risk home automation

**Do not expose the home-relay port (5111) to the internet.** If you need remote access, use a VPN or SSH tunnel.
