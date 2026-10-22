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

Manager replies appear newest first, with the latest reply brought into view automatically. Settings shows the connected manager’s project search root. To configure it, set `REX_PROJECT_ROOT=~/Developer` in `rex/.env.local` and restart the manager (`pnpm --filter rex service restart` for an installed service). The root is enforced on the Mac for browsing and launches. Manager searches query the ranked zoxide history used by `zi` first, restricted to this root. If zoxide is unavailable or has no match, repository scanning stops at repository boundaries and prefers exact project names, so source folders inside another repository do not crowd out the project you meant. The folder browser still allows navigating inside a project.

## Manager agent

`REX_MANAGER_COMMAND_JSON` defines the noninteractive agent command. The manager appends the request, recent conversation, and terminal screen snapshots as one final prompt argument.

The example uses `lambdap --self-contained --no-mcp pi --print ...`. Self-contained mode avoids attaching print requests to a persistent tmux session. The sample disables tools, MCP, extensions, skills, and repository context discovery for a manager that decides structured actions. The Node bridge executes validated terminal launch, input, and key actions; the model receives no unrestricted shell tool. Agent work runs in the selected harness.

Without this setting, sessions, launch presets, and terminal control still work; manager chat reports that it is unconfigured. Model access uses your existing harness configuration.

## Scheduled prompts

A scheduled task is a saved prompt, a noninteractive harness profile, a working directory, and a schedule. It runs directly on your Mac independently of Rex/cmux terminal sessions. Each run starts a fresh harness process, receives the prompt as one literal argument, and saves its output or error. You can also ask an existing agent to keep polling a PR, but that depends on that agent staying alive; saved schedules are owned by the Mac manager.

Set up task commands separately from interactive launch presets:

```sh
cp rex/task-harnesses.example.json rex/task-harnesses.local.json
```

Edit the local file to choose your commands, default project paths, model flags, and MCP configuration. The example supplies Pi print mode, Claude print mode, and Codex exec mode through `lambdap --self-contained`. Keep wrapper flags before the harness and harness flags after it. For example, this additional profile enables selecting a particular MCP configuration in the app:

```json
{
  "id": "claude-github",
  "label": "Claude with GitHub MCP",
  "cwd": "/Users/briankemper/Developer/dak",
  "command": [
    "lambdap",
    "--self-contained",
    "claude",
    "--print",
    "--mcp-config",
    "/absolute/path/to/github-mcp.json"
  ]
}
```

Commands must work without an interactive terminal and print their result before exiting. Use an absolute path for MCP config files if tasks run in different projects. The prompt is appended after the configured argv, so a wrapper script is also supported. Task profiles inherit their harness’s authentication, context files, tool permissions, and extensions; the manager’s restricted Pi command does not control these. The scheduler does not bypass approval prompts. Configure the permissions needed for your intended unattended work in the chosen harness. Restart the foreground manager or `pnpm --filter rex service restart` after changing profiles.

In the app, open **Scheduled tasks** to create, edit, pause, resume, delete, or **Run now**, and inspect recent results. The harness picker shows each configured command. Or ask the manager:

- “Every thirty minutes, use Claude with GitHub MCP in ssa-api to check PR 12 and report what needs attention.”
- “Use Pi in dak tomorrow at nine to run the tests and summarize the result.”
- “Every weekday at nine, check that PR with Claude in mainhost.”
- “List my scheduled tasks.” / “Pause the PR check.” / “Run the PR check now.”

Voice requests must identify the prompt, task harness, project, and schedule. The manager asks when those are missing or ambiguous. It uses the Mac’s timezone unless you specify another. Project lookup and directory restrictions match ordinary agent launches. Greywall and no-MCP voice overrides use the same validated wrapper options; other command variations are separate profiles.

Schedules support one-time dates, intervals in minutes, daily times, and selected weekdays in an IANA timezone. These are structured schedules rather than Unix crontab expressions. Daily and weekly schedules follow local daylight saving time: nonexistent times are skipped and automatic runs do not repeat during a clock rollback. Intervals start from saving/resuming the task and from each automatic run. Manual **Run now** leaves the schedule unchanged. Editing a task preserves whether it was paused.

The Mac manager must be running, and the laptop must be awake. A missed one-time task runs once when the manager returns; recurring occurrences more than a minute late are skipped rather than replayed. Only one scheduled run executes at a time, with a 15-minute limit and a 1 MiB process-output limit. Tasks waiting behind another run can miss an occurrence under the same rule. Failed runs are recorded without automatic retries. Interrupted runs are marked failed on restart. Pausing prevents future runs and does not stop one already running.

Task definitions and the latest 100 runs are saved atomically in `rex/scheduled-tasks.local.json` with private file permissions. These files and `task-harnesses.local.json` are ignored by Git. `REX_TASKS_FILE` and `REX_TASK_HARNESSES_FILE` can override the paths (relative paths resolve from `rex`). Keep one Mac manager process using a given task store. Results survive manager restarts and service updates from this checkout. The service update command does not pull Git changes.

The connected PWA polls for results and reads completed runs when **Read manager replies aloud** is enabled or a voice call is active. Results wait while you are speaking or answering a choice; the app remembers which it has announced on that device. Full output remains in **Recent runs**. Results are saved while the phone app is closed, but speech requires the app to be open and visible; this does not add locked-screen/background push notifications.

### Android push with ntfy

Each task can optionally set an **ntfy topic**. Subscribe to that topic using the [Android ntfy app](https://ntfy.sh/), and use the same server on both the phone and Mac. A finished or failed run sends its result to the topic even when the Agent Voice PWA is closed. Set the topic in the task editor, or say “Notify my topic `my-chosen-topic` when this task finishes.” Blank topics disable push. Different tasks can share a topic or use separate topics.

The Mac defaults to `https://ntfy.sh`; for your own server, set `REX_NTFY_URL=https://ntfy.example.com` in `rex/.env.local`. Set `REX_NTFY_TOKEN` there if the server/topic requires authentication, then restart the manager. Tokens stay on the Mac. On the public server, an unprotected topic name is accessible to anyone who knows it; use a protected topic or your private server for Jira/project details.

Notifications preserve paragraphs and include up to 3,500 UTF-8 bytes of output/error, within ntfy’s documented 4,096-byte message limit. Two-paragraph summaries normally fit. Ask for the desired summary length in the task prompt. Longer results are visibly truncated with an ellipsis and remain in full (up to the 24,000-character run-history limit) in **Recent runs**. Android may show a shortened notification preview; open ntfy to read the message. No task output is sent to ntfy unless that task has a topic.

Run history shows whether ntfy accepted the publish request or it failed. A push failure does not change a successful harness result into a failed run. Push publishing has a ten-second timeout and is not automatically retried, including after an interrupted notification. “Sent” means accepted by the server, not confirmed phone delivery. The phone still needs access to the configured ntfy server, and its Android notification/background settings must permit ntfy notifications.

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
