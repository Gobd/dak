# Rex Voice

An installable PWA for talking to your Rex agents from Android. It follows the other top-level DAK apps: React, the shared theme and UI, Vite, and the shared PWA configuration.

## Where each piece runs

- **Phone:** microphone, Chrome speech recognition, Android/browser text-to-speech, and saved settings.
- **Cloudflare Pages:** the static PWA at `/rex/`.
- **Mac:** a Node manager that calls the installed Rex CLI and optionally a manager agent through `lambdap`.
- **WireGuard / OPNsense:** the private connection between the phone and your home servers.

The Mac manager trusts your private LAN/VPN connection. It has no separate access key. Keep its listener or reverse proxy private; Cloudflare Functions do not proxy it or expose it publicly.

Speech recognition may use Google's online service. Choosing a voice marked “on device” uses a locally supplied speech voice. The Mac receives the final transcript rather than microphone audio. Recognition and voice playback run while the app is open; this PWA does not implement a background wake word.

## Voice and keyboard

Tap the microphone, speak, and pause or tap again to finish. **Automatic send is the default.** Only final recognition results are sent; interim results never submit requests.

Enable **Review before sending** to edit the transcript first. Keyboard input is always available for corrections. Turn spoken manager replies on or off, select a voice, and stop playback at any time. A reply can also be played manually when Android blocks automatic playback.

The private manager address, voice, send mode, playback preference, and successful-connection setting are stored in the phone browser's local storage. The app reconnects on the next launch. Clearing site data clears these settings. Conversation history is also stored on the phone, with a Clear conversation control.

**Manager** answers questions using current Rex terminal screens. **Agent terminal** sends a message to the selected terminal and displays its current screen, refreshed every three seconds. Screen capture is not the full transcript and does not identify a complete assistant response; terminal screens are not automatically spoken. Select a terminal running your agent before sending—Return submits input to whichever program is running.

## Mac setup

From this repository:

```sh
pnpm install
cp rex/.env.example rex/.env.local
cp rex/launchers.example.json rex/launchers.local.json
pnpm --filter rex dev
```

The server automatically locates Rex Beta's bundled executable on macOS. Set `REX_BIN` for a different installation. Rex must already be running; the manager does not restart it.

The manager defaults to loopback on port 5184. `pnpm --filter rex dev` starts both Vite (5183) and the manager (5184). For separate terminals, use `pnpm --filter rex dev:app` and `pnpm --filter rex dev:manager`. A 502 from `/rex/api/status` usually means the manager is not running.

Open `http://localhost:5183/rex/`. Leave the manager address blank; Vite proxies API requests to the local manager on port **5184**. You can also enter `http://localhost:5184` explicitly. Localhost is a secure-context exception, so local testing on this Mac does not need an HTTPS certificate.

### HTTPS from Android

Microphone access and PWA installation require a trusted HTTPS origin. The manager address used by a Cloudflare-hosted PWA must also use HTTPS.

Either use your private HTTPS reverse proxy to forward to the Mac manager, or configure `REX_TLS_CERT` and `REX_TLS_KEY` with a certificate trusted by Android and set `REX_HOST` to the Mac's actual LAN address. A self-signed certificate warning does not provide a reliable secure context.

Use an internal DNS name with a trusted certificate that resolves to the Mac or private reverse proxy. A domain certificate can be obtained using DNS validation without exposing the service to the internet. WireGuard does not supply HTTPS certificates.

In PWA Settings, enter the manager **origin**, such as `https://rex.bkemper.me`, with no path. That hostname is an example; configure its DNS and certificate before using it. The PWA calls `/rex/api/` at that origin.

`REX_ALLOWED_ORIGINS` defaults to `https://dak.bkemper.me,http://localhost:5183`. For a Pages preview, add its exact origin to the comma-separated list. The manager handles CORS and private-network preflight requests for these origins. Chrome may ask for permission to access devices on your local network.

## WireGuard: only home traffic

Your home LAN uses **192.168.84.x**. This laptop currently has **192.168.84.99** (checked with `ipconfig getifaddr en0`); reserve that address in DHCP or recheck it if the lease changes. Assuming its subnet is `192.168.84.0/24`, duplicate your current Android WireGuard profile and replace the peer's full-tunnel routes:

```ini
# Before: all IPv4 and IPv6 traffic
AllowedIPs = 0.0.0.0/0, ::/0

# After: only your home LAN
AllowedIPs = 192.168.84.0/24
```

Keep the existing endpoint, keys, and tunnel address when duplicating the profile for the same phone. Activate one of those duplicate profiles at a time.

For only specific servers, list their addresses instead. These are illustrative addresses—replace them with your actual Mac, reverse proxy, and DNS server:

```ini
AllowedIPs = 192.168.84.99/32, 192.168.84.60/32, 192.168.84.1/32
```

If your manager hostname requires home DNS, include that DNS server's address and configure the profile's DNS field accordingly. Using home DNS can send DNS queries through the tunnel even though other traffic remains outside it.

OPNsense must allow the phone's WireGuard peer to reach the manager or private reverse proxy. Your existing WireGuard setup may already provide that route; changing `AllowedIPs` changes the phone's routing, not the router firewall.

Remove `::/0` unless you intend to tunnel all IPv6 traffic. If your home servers use IPv6, add their actual home IPv6 prefix separately. Regular phone traffic then uses mobile data or Wi-Fi, while home addresses use WireGuard.

## Launch presets and argument order

Edit `rex/launchers.local.json`. Each preset defines an ID, display label, absolute working directory, and an **ordered argument array**:

```json
{
  "id": "pi-greywall",
  "label": "Pi · Greywall, no MCP",
  "cwd": "/Users/briankemper/Developer/dak",
  "command": ["lambdap", "--no-mcp", "--greywall", "pi", "--thinking", "high"]
}
```

That launches exactly:

```sh
lambdap --no-mcp --greywall pi --thinking high
```

Flags before `pi` belong to `lambdap`. Flags after `pi` belong to Pi. The same pattern applies to `claude` and `codex`. The manager preserves ordering and does not build a shell command from phone input. For setup steps, use a configured wrapper script as the executable.

Tap **Start an agent** to select a preset, browse or search for a working directory, and start a session. The folder picker and launches stay within `REX_PROJECT_ROOT`, which defaults to the parent of DAK (your Developer directory). Search covers up to five levels and 100 matches, skipping dependency, build, and hidden folders. For interactive menus and trust prompts, use the terminal key buttons: arrows, Enter, Esc, and Tab. Spoken messages are sent as text rather than interpreted as menu choices. Preset changes take effect when you restart the Mac manager. The new session runs on the Rex server; opening it in the Mac app is a separate UI action.

## Manager agent

`REX_MANAGER_COMMAND_JSON` defines the noninteractive agent command. The manager appends the request, recent conversation, and a Rex screen snapshot as one final prompt argument.

The example uses `lambdap --self-contained --no-mcp pi --print ...`. Self-contained mode avoids attaching print requests to a persistent tmux session. The sample disables tools, MCP, extensions, skills, and repository context discovery for a manager that summarizes screens. Agent work and terminal input use the selected agent terminal.

Without this setting, sessions, launch presets, and terminal control still work; manager chat reports that it is unconfigured. Model access uses your existing harness configuration.

## Build and checks

```sh
pnpm --filter rex test
pnpm --filter rex typecheck
pnpm build:pages
```

The workspace and Pages build include Rex. The site index links to `/rex/`. Pages middleware serves the Rex app while `/rex/api/*` returns a setup message rather than the SPA HTML. GitHub Actions' `pnpm check` runs the manager tests and builds the complete Pages bundle. The Mac manager is not uploaded to Pages.

To serve the production PWA directly from the Mac manager, build it and the shared vendor assets first:

```sh
pnpm build:react-vendor
pnpm --filter rex build
pnpm --filter rex start
```

## Next: conversational voice control

The current app sends finalized speech directly to a selected harness or asks a read-only manager about terminal screens. A future conversational manager can start sessions by project name, read numbered folder matches and live menu options, and interpret follow-ups such as “two” or “yes” against the pending choice. That requires explicit pending-choice state and structured launch/key actions; the current manager does not perform those actions from free-form speech.
