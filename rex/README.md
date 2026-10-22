# Agent Voice

An installable PWA for talking to agents running in Rex or cmux from Android. It follows the other top-level DAK apps: React, the shared theme and UI, Vite, and the shared PWA configuration.

## Where each piece runs

- **Phone:** microphone, Chrome speech recognition, Android/browser text-to-speech, and saved settings.
- **Cloudflare Pages:** the static PWA at `/rex/`.
- **Mac:** a Node manager that calls the selected terminal app’s local CLI and optionally a manager agent through `lambdap`.
- **WireGuard / OPNsense:** the private connection between the phone and your home servers.

The Mac manager trusts your private LAN/VPN connection. It has no separate access key. Keep its listener or reverse proxy private; Cloudflare Functions do not proxy it or expose it publicly.

Speech recognition may use Google's online service. Choosing a voice marked “on device” uses a locally supplied speech voice. The Mac receives the final transcript rather than microphone audio. Recognition and voice playback run while the app is open; this PWA does not implement a background wake word.

## Voice and keyboard

Tap the microphone, speak, and pause or tap again to finish. **Automatic send is the default.** Only final recognition results are sent; interim results never submit requests.

Enable **Review before sending** to edit the transcript first. Keyboard input is always available for corrections. Turn spoken manager replies on or off, select a voice, and stop playback at any time. A reply can also be played manually when Android blocks automatic playback.

The private manager address, voice, send mode, playback preference, and successful-connection setting are stored in the phone browser's local storage. The app reconnects on the next launch. Clearing site data clears these settings. Conversation history is also stored on the phone, with a Clear conversation control. Select Rex or cmux in Settings; switching providers clears the conversation and selected terminal so input cannot cross between apps.

**Manager** is an AI coordinator: it checks sessions, searches projects, starts configured harnesses, forwards prompts, and reads or answers terminal options. Ambiguous requests produce up to five numbered spoken choices; more than five matches prompts you to narrow the request. follow up with a number or yes/no. Choices belong to the phone conversation, expire after ten minutes, and menu selections are checked against the current terminal screen. **Agent terminal** sends a message to the selected terminal and displays its current screen, refreshed every three seconds. Screen capture is not the full transcript and does not identify a complete assistant response; terminal screens are not automatically spoken. Select a terminal running your agent before sending—Return submits input to whichever program is running.

## Mac setup

The frontend displays **Agent Voice**; its workspace folder, package name, and Pages route remain `rex` and `/rex/`.

The manager is TypeScript. DAK pins Node 24, which strips erasable types and runs the `.ts` files directly. There is no server build step; `pnpm typecheck` checks the server as well as the frontend. `pnpm test` runs tests across workspaces.

From this repository:

```sh
pnpm install
cp rex/.env.example rex/.env.local
cp rex/launchers.example.json rex/launchers.local.json
pnpm --filter rex dev
```

The server automatically locates Rex Beta's bundled executable on macOS. Set `REX_BIN` for a different installation. Open the terminal app you select before connecting; the manager does not restart Rex or cmux. cmux must have its socket API enabled. Set `CMUX_BIN` if its executable is not on PATH. `CMUX_SOCKET_PATH` and `CMUX_SOCKET_PASSWORD` are passed through to the cmux CLI.

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

Flags before `pi` belong to `lambdap`. Flags after `pi` belong to Pi. The same pattern applies to `claude` and `codex`. Rex receives separate argv values. cmux requires an initial command string, so the adapter shell-quotes every configured argument individually; spoken text is never treated as a launch command. For setup steps, use a configured wrapper script as the executable.

Tap **Start an agent** to select a preset, browse or search for a working directory, and start a session. The folder picker and launches stay within `REX_PROJECT_ROOT`, which defaults to the parent of DAK (your Developer directory). Search covers up to five levels and 100 matches, skipping dependency, build, and hidden folders. For interactive menus and trust prompts, use the terminal key buttons: arrows, Enter, Esc, and Tab. In Agent terminal mode, spoken messages are literal text. In Manager mode, spoken yes/no or numbers can select the choices it just read. Preset changes take effect when you restart the Mac manager. Choose a new session/workspace or a new terminal in an existing one. The same option is available by voice. New cmux workspaces include their initial terminal; additional terminals use the named workspace. Rex creates a session or a new tab within an existing session. The manager can see and inspect agents started manually too.

## Manager agent

`REX_MANAGER_COMMAND_JSON` defines the noninteractive agent command. The manager appends the request, recent conversation, and terminal screen snapshots as one final prompt argument.

The example uses `lambdap --self-contained --no-mcp pi --print ...`. Self-contained mode avoids attaching print requests to a persistent tmux session. The sample disables tools, MCP, extensions, skills, and repository context discovery for a manager that decides structured actions. The Node bridge executes validated terminal launch, input, and key actions; the model receives no unrestricted shell tool. Agent work runs in the selected harness.

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

## macOS background service

For a one-off manager process (no service installation):

```sh
pnpm --filter rex dev:manager  # foreground, reloads TypeScript edits
pnpm --filter rex start        # foreground, without watching
```

Keep that terminal open; Ctrl+C stops it. During development, `pnpm --filter rex dev` starts the frontend too. For a permanent manager, stop the foreground manager first so port 5184 is free, then install the login service:

```sh
pnpm --filter rex service install
pnpm --filter rex service status
pnpm --filter rex service logs
pnpm --filter rex service logs --follow
pnpm --filter rex service logs --open
pnpm --filter rex service restart
pnpm --filter rex service stop
pnpm --filter rex service start
pnpm --filter rex service uninstall
```

This installs a per-user LaunchAgent at `~/Library/LaunchAgents/dev.dak.agent-voice.plist`. It starts at login and restarts after a crash, while the Mac is awake. It uses this checkout’s absolute path, the installed Node executable and PATH, and `rex/.env.local`. Secrets are not copied into the plist. Keep the checkout where it is or reinstall after moving it. Rex/cmux must still be open.

`status` shows installation, launchctl state/PID, and API health. To check cmux health, use `VOICE_PROVIDER=cmux pnpm --filter rex service status`. Logs live in `~/Library/Logs/DAK/Agent Voice/`; `logs --open` opens them in VS Code when `code` is installed, otherwise the default text editor. `stop` unloads until the next login; `uninstall` removes the LaunchAgent and keeps your configuration and logs.

A LaunchAgent runs outside a cmux terminal. If cmux’s socket mode permits only descendant processes, background access will be denied. Configure a socket access mode that permits the manager in cmux Settings; password mode with `CMUX_SOCKET_PASSWORD` in `.env.local` is supported. The CLI does not change cmux settings for you.

After pulling repository changes:

```sh
git pull
pnpm --filter rex service update
```

`update` installs dependencies using the frozen lockfile, rewrites the plist with the current Node/PATH and checkout location, and restarts the service. It uses the current checkout and does not pull or switch branches. If dependency installation fails, it leaves the running service alone. For only TypeScript or `.env.local` changes, `service restart` is enough. For a frontend served directly from the manager, rebuild the shared vendor assets and app with the build commands above; Cloudflare Pages builds its frontend separately.

## Voice calls and native status

Select **Manager**, use automatic send, and tap **Start voice call**. It listens between replies, pauses the microphone during voice playback, and reads manager replies aloud. End the call to stop hands-free listening. Keyboard corrections and manual microphone turns remain available; review mode is intended for manual turns.

While a voice call is active, the app checks native status every five seconds across up to twelve sessions/workspaces and eight terminals per session. Enable **Announce agent status while the app is open** for announcements outside a call. Blocked, done, error, and transitions from working to idle trigger concise manager announcements. It pauses further announcements while you answer numbered choices, so a second notification cannot replace the question you are answering. Repeated states and progress updates do not keep speaking.

Both adapters return the same normalized records. Rex reads `program_status` (OSC 7501) directly. cmux subscribes to `program_status.changed`, replays retained events, reassembles chunked snapshots, and clears stale data on restart or replay gaps. cmux intentionally omits free-form messages from those events; the manager reads the screen to explain the question. Its native agent lifecycle is a fallback when no OSC snapshot is retained. Unknown status remains unknown. No screen-inactivity heuristic declares an agent done.

An automatic notification may read choices, but never sends input or accepts a permission by itself. Your spoken response selects a remembered action; the bridge checks that the terminal screen still matches before sending menu keys. Claude, Codex, and Pi versions/extensions that emit OSC 7501 work without being launched by this manager.

**Android background limitation:** the PWA must stay open and visible. It works with headphones while active, but locked-screen/pocket use is not reliable: Android can suspend the page and microphone. Hiding the app ends the voice call; return and tap Start voice call again. A native Android foreground service would be needed for dependable background calls. Mac sleep also suspends the manager; a login service does not keep the laptop awake.

## Conversational voice control

Manager is the default conversation target. Try “What sessions are running?”, “What is Claude doing?”, “Start Pi with Greywall and no MCPs in mainhost”, “Start another terminal in that workspace”, or “Read the current options.” The manager searches project names, uses your configured launchers, and asks numbered questions when more than one choice fits. Reply “two” or “yes” to choose. Voice-selected wrapper flags are limited to `--greywall` and `--no-mcp`; they go before the harness name. Omit them to preserve the configured preset defaults. It can also forward a prompt to an existing agent.

The bridge verifies menu screens before applying remembered choices, so an old “yes” cannot select an option on a changed prompt. Manager replies are concise for spoken playback. Screens are snapshots rather than complete chat transcripts; agent replies are read when you ask the manager, rather than automatically streamed as speech.
