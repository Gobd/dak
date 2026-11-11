# Clock

A standalone canvas-based 24-hour clock at `/clock/`, designed to keep animation work low on inexpensive Raspberry Pi displays. No backend or account is needed unless you enable the optional calendar feed.

## Display

- **Circular:** fills the largest circle that fits the viewport, with hour labels and controls inside the rim. Midnight is at the top, noon at the bottom; the long hand rotates once per day and the shorter second hand once per minute. No header, footer, or legend. On square/circular displays the rim reaches the edges; rectangular screens have spare space on two sides.
- **Linear / rectangle:** daylight/night shading fills the clock area edge-to-edge. Midnight is left, 24:00 right. A compact **top bar** (default) or **bottom bar** holds digital time, date, solar times, calendar legend/status, controls, and the optional agenda/weather. Choose **No bar — overlay** for the original layout. The current-time vertical marker and seconds sweep/track can be hidden independently without hiding digital seconds.
- **Rectangle elapsed-time wipe:** optionally cover midnight through now, including past labels and event marks. Choose a wipe color and opacity (0–100%); 100% gives a solid blackout. It never touches the info bar or circular clock.
- Light sections show day, dark sections night. Boundaries mark sunrise/sunset; exact times are optional and hidden by default.
- Optional digital time and date sit inside the clock. Small theme, fullscreen, and settings controls brighten on hover/focus; `f=1` removes them.
- Polar day/night are handled without invalid solar labels.

## Settings and time

Open the gear to configure **Clock shape**, **Starter themes**, **Info bar**, **Weather**, **Elapsed time & markers**, **Time & date**, **Clock colors**, **Location**, **Calendar events**, and **Kiosk link**. Rectangle-only sections disappear for the circle. The dialog keeps a stable responsive width as options expand; extra weather details and advanced calendar IDs/refresh options are tucked into expandable sections. Seconds labels match the selected shape, and help text explains that the wipe, vertical time marker, and seconds sweep are independent. North/east are positive; south/west negative. **Use current location** asks for browser geolocation permission only when clicked (HTTPS or localhost), then fills editable latitude/longitude fields. It does not save automatically; Save or Copy URL uses the new coordinates. Denial/unavailable/timeout errors leave manual entry available and preserve existing coordinates. Manual edits cancel a pending result; closing the dialog ignores it. Blank coordinates show a clock without daylight calculation; initial launch does not assume a location.

Hour labels can be 24-hour (`00–23`) or repeated 12-hour (`12, 1…11`, twice). The clock still spans 24 hours. Digital time has its own independent **12-hour with AM/PM** or **24-hour** setting (24-hour by default). URL options: `hourLabels=24h|12h` and `digitalTimeFormat=24h|12h`. Solar and agenda event times remain 24-hour.

Date formats: hidden (default), weekday only, month/day, weekday/date, full date with year, locale-specific numeric date, or ISO YYYY-MM-DD.

Rectangle **starter themes**: **Midnight** (dark charcoal/cream), **Paper** (bright ivory/slate), **Sand** (warm in-between neutrals), **Dusk** (muted plum/lavender), and **Slate & Cream** (the original demo's exact blue-gray/tan colors). Buttons preview each palette with its background/text colors and clock-color swatches, with consistently left-aligned names/descriptions. Each fills in editable clock/bar/wipe colors and its light/dark mode; layout, weather toggles and wipe opacity stay as-is. It restores individual calendar colors. Apply a preset, then tweak any picker. Save applies its display mode; Copy URL includes the draft mode/colors even without saving. Presets are materialized colors, not a new theme-name dependency in kiosk URLs.

Color pickers control day, night, the 24-hour hand/marker, second hand/marker, and optionally all event marks. Rectangle bar background and text have independent color pickers and a reset-to-theme button; weather text also follows the bar text color. Without an event-color override, events use each Google calendar’s color. Custom colors persist across themes; Reset to theme colors restores defaults. Hour labels automatically contrast with custom day/night colors. Semantic default aliases are in `clock/src/index.css`.

Settings persist in localStorage under `clock-settings`; theme uses `clock-dark-mode`. They are independent of dashboard settings. Event snapshots are **not** persisted to localStorage.

**Times use the device/browser timezone.** Coordinates affect solar calculation, not timezone. Set the kiosk’s OS timezone appropriately. Solar boundaries refresh at midnight, on timezone-offset changes, and on tab return. The dial represents 24 wall-clock hours, including DST transitions: the hand follows skipped/repeated hours.

SunCalc computes approximate sunrise/sunset locally, with no permission prompt or network lookup. The optional **Use current location** button separately requests browser permission; optional weather sends the chosen coordinates to Open-Meteo. Enable OS time synchronization (NTP), especially on a Pi Zero without a battery-backed clock. The app re-reads system time each rendered frame (or each minute without seconds), rather than accumulating timer ticks. It does not fetch network time itself.

## Optional rectangle weather

Enable **Today's weather** and/or **Tomorrow's weather** independently in rectangle settings, with Fahrenheit (default) or Celsius. The top/bottom bar shows each day's condition icon, low/high and maximum probability of any precipitation; a snow icon appears for snowy forecasts. The percentage is **not separate rain and snow probabilities**. Weather is off by default and is not shown in circular/overlay mode.

Uses Open-Meteo directly (no home-relay weather endpoint, account or key needed). Enabling it sends the configured coordinates to Open-Meteo. Forecast dates follow the **device timezone**, just like the clock. Data refreshes every 30 minutes, at midnight, after coordinate/unit changes, and on tab return; requests stop while hidden and time out after 10 seconds. Failed refreshes retain the current day's last forecast with an update warning; location/date changes clear old data. Missing coordinates and network failures display a compact status. The weather attribution links to Open-Meteo.

## No-input kiosk and URL options

Configure on a laptop, open Settings, and click **Copy display URL**. It includes every current form value and the current theme; saving first is unnecessary. The default copy option hides controls. A selectable text field exposes the URL if clipboard permission is unavailable.

Valid URL values override saved settings. Missing/invalid values fall back to saved settings. Copied links explicitly encode blanks/defaults so another browser does not inherit a previous location, custom palette, or calendar source.

| Parameter                                                                                                                                | Values                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `digitalTimeFormat`                                                                                                                      | `24h` (default), `12h` with AM/PM; independent of dial labels                                                                 |
| `barColor`, `barTextColor`                                                                                                               | Six-digit hex; blank for theme defaults; rectangle info bar only                                                              |
| `rectangleBar`                                                                                                                           | `top` (default), `bottom`, `overlay` — rectangle only                                                                         |
| `wipePast`, `showTimeMarker`, `showSecondsMarker`                                                                                        | `1` or `0` — rectangle only                                                                                                   |
| `wipeColor`                                                                                                                              | Six-digit hex, blank for theme default; rectangle only                                                                        |
| `wipeOpacity`                                                                                                                            | 0–100, default 85; rectangle only                                                                                             |
| `showWeather`, `showTomorrowWeather`                                                                                                     | `1` or `0`, independent today/tomorrow toggles; top/bottom rectangle bar only                                                 |
| `weatherUnit`                                                                                                                            | `fahrenheit` (default), `celsius`                                                                                             |
| `mode`                                                                                                                                   | `circle`, `linear`                                                                                                            |
| `seconds`, `showTime`, `showSolarTimes`, `showEventList`, `showCalendarStatus`, `showCalendarLegend`, `showEventNames`, `calendarFilter` | `1` or `0`                                                                                                                    |
| `date`                                                                                                                                   | `none`, `weekday`, `monthDay`, `weekdayDate`, `full`, `numeric`, `iso`                                                        |
| `lat`, `lng`                                                                                                                             | Both coordinates, or both blank to clear location                                                                             |
| `dayColor`, `nightColor`, `handColor`, `secondColor`, `eventColor`                                                                       | Six-digit hex; encode `#` as `%23`; blank means default                                                                       |
| `calendarRelay`                                                                                                                          | Relay base URL; blank disables calendars                                                                                      |
| `calendars`                                                                                                                              | JSON array of included Google calendar IDs. Used when `calendarFilter=1`; `[]` then means none. `calendarFilter=0` means all. |
| `eventStyle`                                                                                                                             | `band` (default), `dot`, `none`                                                                                               |
| `eventPlacement`                                                                                                                         | `outside` (outside circle / below rectangle, default), `inside` (inside / above)                                              |
| `calendarPollSeconds`                                                                                                                    | 30–3600; default 60                                                                                                           |
| `theme`                                                                                                                                  | `light`, `dark`                                                                                                               |
| `f`                                                                                                                                      | `1` hides controls; `0` keeps them                                                                                            |
| `kiosk`, `fullscreen`                                                                                                                    | `1` are aliases for `f=1`                                                                                                     |

Example without a calendar:

```text
https://dak.bkemper.me/clock/?mode=circle&lat=40.7128&lng=-74.006&seconds=1&showTime=0&date=weekdayDate&theme=dark&f=1
```

The app fills the browser viewport. URL flags cannot trigger browser fullscreen without a gesture; Cage/Chromium kiosk startup already handles that:

```bash
chromium --kiosk 'PASTE_DISPLAY_URL_HERE'
```

Restore controls with `f=0` (remove any `kiosk=1` / `fullscreen=1` aliases too). No need to erase localStorage.

For Orange Pi Zero 2W / Debian-based Armbian setup, see [`clock/scripts/README.md`](../clock/scripts/README.md). The laptop installer accepts the complete copied URL:

```bash
bash clock/scripts/setup-kiosk-remote.sh user@orange-pi 'PASTE_DISPLAY_URL' America/New_York
```

It installs Cage/Chromium and console autologin without Pi-specific boot/display changes. Hardware/driver compatibility still depends on the OS image.

## Optional Google Calendar feed

Clock does **not** sign into Google. It reuses your existing signed-in dashboard:

```text
Google Calendar → dashboard browser → home-relay RAM snapshot → Clock
```

### One-time setup

1. Deploy/restart the updated relay and deploy the updated dashboard/Clock builds.
2. Generate a publishing key: run `openssl rand -hex 24`.
3. Set `CALENDAR_PUBLISH_KEY` in the relay environment. For systemd, run `sudo systemctl edit home-relay`:

   ```ini
   [Service]
   Environment="CALENDAR_PUBLISH_KEY=YOUR_RANDOM_KEY"
   ```

   Then `sudo systemctl daemon-reload && sudo systemctl restart home-relay`.

4. In the **source kiosk’s dashboard browser**, sign into Google as usual. In Calendar widget settings enter the publishing key under **Clock calendar publishing key**. It is stored only in that browser’s localStorage (`calendar-feed-publish-key`), never synced dashboard config. Blank disables publishing.
5. On your laptop, open Clock settings and enter the **local relay base URL**. No read key is required. Choose marks, placement, optional agenda, colors, and theme. Copy the URL into the no-input kiosk startup command. All Clock options, including theme and calendar options, are in the link.

The publisher freshly fetches a rolling three-day window (previous 24 hours plus next 48 hours), independently of the month/week displayed on the dashboard. It paginates Google results, expands recurring events, excludes cancelled events, and shares only visible calendars. It sends titles, start/end, IDs, calendar names/colors—**not descriptions, locations, or Google tokens**.

Publication runs on normal dashboard refresh (normally every five minutes), initial load, visible-calendar/publishing-key changes, and event edits that refresh the calendar. Any fetch/page failure preserves the previous snapshot rather than publishing partial data. Exceeding limits reports an error, not silent truncation.

### Event display

- **Bands:** show duration as an arc or straight segment.
- **Dots:** show timed-event start times; all-day events still use a full ring/line.
- Overlaps stack in separate lanes. All-day events get their own full-day lanes. Up to five lanes draw; excess overlaps are reported when status is enabled. The optional agenda shows the first five events plus a remaining count.
- Midnight-crossing events clip to today with continuation ticks; agenda arrows indicate continuation. Google all-day end dates are exclusive and are not shifted by UTC parsing.
- Fall-back-hour events occupy their wall-time range (minimum one-minute band), with a DST note in the agenda. A wall-clock dial cannot distinguish both occurrences of the same hour.
- Optional calendar-color legend; event names on marks and the daily agenda are separate toggles, both off by default. Labels on marks are abbreviated, use dedicated clearance from their bars, and are suppressed when they collide or there is insufficient space. Marks remain visible; use the agenda for names in dense schedules.
- Calendar checkboxes select a subset; **All shared calendars** bypasses the filter. Turning every calendar off produces `calendarFilter=1&calendars=[]`, not a fallback to all. Checkboxes list all shared calendars, including those without current events; IDs can also be entered directly.
- Polling stops while hidden and refreshes on tab return. Connection/stale/expired/coverage status can be hidden.

### Storage, expiry, and security

**No new database, files, or event history.** One snapshot lives in relay RAM. Each successful PUT replaces it entirely—including empty snapshots after deletion or hiding all calendars. Restarting the relay clears it.

Limits: **1,000 events**, **100 calendars**, **1 MiB request body**, four-day maximum coverage window, and bounded field lengths. Events must overlap the window. A cleanup task runs every minute; reads/writes also prune. Completed timed events remain up to 24 hours for the daily agenda; floating all-day dates get a one-day timezone allowance. The entire snapshot expires **24 hours after publication** and is stale after **15 minutes**. Clock enforces expiry locally even when disconnected. Browser memory holds only the latest feed.

The source Calendar widget must remain mounted/running and signed in. If it closes, switches to a screen without the calendar, signs out, or loses Google access, data becomes stale and then disappears. Disabling publication does not instantly revoke the last snapshot: send an empty PUT or restart the relay for immediate removal.

| Endpoint                 | Credential                                   | Behavior                                    |
| ------------------------ | -------------------------------------------- | ------------------------------------------- |
| `PUT /calendar/snapshot` | `Authorization: Bearer CALENDAR_PUBLISH_KEY` | Replace bounded snapshot                    |
| `GET /calendar/snapshot` | None — trusted-network read access           | Read events and freshness/coverage metadata |

Publishing remains protected: an unset `CALENDAR_PUBLISH_KEY` disables PUT (503); an invalid/missing publishing key returns 401. GET requires no authentication and works even before a publisher is configured (an empty snapshot). Responses use `Cache-Control: no-store`. Google credentials never reach relay/Clock.

**Keep home-relay on your LAN/VPN, not the public internet.** Anyone who can reach it can read shared calendar titles, times and calendar names/colors. This is intentional for home kiosks. The clock never needs the publishing key, and copied URLs contain no calendar credentials. Old `calendarKey` URL/localStorage fields are ignored and omitted when links are copied; `CALENDAR_READ_KEY` is no longer used and can be removed from the relay environment. Deploy/restart the updated backend before using the keyless clock client.

## Performance

The face, solar sections, and events are cached in one canvas; only hands redraw on a second transparent canvas. Animation is capped at 30 fps and backing resolution at 1.5×, and stops while hidden. Without seconds, the canvas updates once per minute. Resizing, theme/settings changes, and new event snapshots redraw the face. Actual performance needs checking on the target Pi/browser.

## Development and demos

```bash
pnpm --filter clock dev       # http://localhost:5184/clock/
pnpm --filter clock test
pnpm --filter clock typecheck
pnpm --filter clock build
cd dashboard/services/home-relay && uv run python -m unittest discover -s tests
```

Uses shared `@dak/ui`, `@dak/hooks`, generated `@dak/api-client`, and DAK Vite/theme configuration. Normal Pages builds include the app and landing-page link.

Demo screenshots with fictional events and alternate palettes: [`clock/screenshots/`](../clock/screenshots/README.md).
