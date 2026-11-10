# Clock

A standalone canvas-based 24-hour clock at `/clock/`, designed to keep animation work low on inexpensive Raspberry Pi displays. No backend or account is needed unless you enable the optional calendar feed.

## Display

- **Circular:** fills the largest circle that fits the viewport, with hour labels and controls inside the rim. Midnight is at the top, noon at the bottom; the long hand rotates once per day and the shorter second hand once per minute. No header, footer, or legend. On square/circular displays the rim reaches the edges; rectangular screens have spare space on two sides.
- **Linear / rectangle:** daylight/night shading fills the display edge-to-edge. Midnight is left, 24:00 right. The current-time marker runs the full height; optional seconds sweep across a thin lower track.
- Light sections show day, dark sections night. Boundaries mark sunrise/sunset; exact times are optional and hidden by default.
- Optional digital time and date sit inside the clock. Small theme, fullscreen, and settings controls brighten on hover/focus; `f=1` removes them.
- Polar day/night are handled without invalid solar labels.

## Settings and time

Open the gear to select shape, toggle seconds/digital time/solar times, choose a date format, customize colors, enter latitude/longitude, or enable calendar events. North/east are positive; south/west negative. Blank coordinates show a clock without daylight calculation; initial launch does not assume a location.

Hour labels can be 24-hour (`00–23`) or repeated 12-hour (`12, 1…11`, twice). The clock still spans 24 hours; digital time remains 24-hour. URL option: `hourLabels=24h` or `hourLabels=12h`.

Date formats: hidden (default), weekday only, month/day, weekday/date, full date with year, locale-specific numeric date, or ISO YYYY-MM-DD.

Color pickers control day, night, the 24-hour hand/marker, second hand/marker, and optionally all event marks. Without an event-color override, events use each Google calendar’s color. Custom colors persist across themes; Reset to theme colors restores defaults. Hour labels automatically contrast with custom day/night colors. Semantic default aliases are in `clock/src/index.css`.

Settings persist in localStorage under `clock-settings`; theme uses `clock-dark-mode`. They are independent of dashboard settings. Event snapshots are **not** persisted to localStorage.

**Times use the device/browser timezone.** Coordinates affect solar calculation, not timezone. Set the kiosk’s OS timezone appropriately. Solar boundaries refresh at midnight, on timezone-offset changes, and on tab return. The dial represents 24 wall-clock hours, including DST transitions: the hand follows skipped/repeated hours.

SunCalc computes approximate sunrise/sunset locally, with no permission prompt or network lookup. Enable OS time synchronization (NTP), especially on a Pi Zero without a battery-backed clock. The app re-reads system time each rendered frame (or each minute without seconds), rather than accumulating timer ticks. It does not fetch network time itself.

## No-input kiosk and URL options

Configure on a laptop, open Settings, and click **Copy display URL**. It includes every current form value and the current theme; saving first is unnecessary. The default copy option hides controls. A selectable text field exposes the URL if clipboard permission is unavailable.

Valid URL values override saved settings. Missing/invalid values fall back to saved settings. Copied links explicitly encode blanks/defaults so another browser does not inherit a previous location, custom palette, or calendar source.

| Parameter                                                                                                                                | Values                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                                                                                                                   | `circle`, `linear`                                                                                                            |
| `seconds`, `showTime`, `showSolarTimes`, `showEventList`, `showCalendarStatus`, `showCalendarLegend`, `showEventNames`, `calendarFilter` | `1` or `0`                                                                                                                    |
| `date`                                                                                                                                   | `none`, `weekday`, `monthDay`, `weekdayDate`, `full`, `numeric`, `iso`                                                        |
| `lat`, `lng`                                                                                                                             | Both coordinates, or both blank to clear location                                                                             |
| `dayColor`, `nightColor`, `handColor`, `secondColor`, `eventColor`                                                                       | Six-digit hex; encode `#` as `%23`; blank means default                                                                       |
| `calendarRelay`                                                                                                                          | Relay base URL; blank disables calendars                                                                                      |
| `calendarKey`                                                                                                                            | Read-only calendar key; blank clears it                                                                                       |
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
2. Generate two **different** random keys: run `openssl rand -hex 24` twice.
3. Set `CALENDAR_PUBLISH_KEY` and `CALENDAR_READ_KEY` in the relay environment. For systemd, run `sudo systemctl edit home-relay`:

   ```ini
   [Service]
   Environment="CALENDAR_PUBLISH_KEY=YOUR_FIRST_RANDOM_KEY"
   Environment="CALENDAR_READ_KEY=YOUR_SECOND_RANDOM_KEY"
   ```

   Then `sudo systemctl daemon-reload && sudo systemctl restart home-relay`.

4. In the **source kiosk’s dashboard browser**, sign into Google as usual. In Calendar widget settings enter the publishing key under **Clock calendar publishing key**. It is stored only in that browser’s localStorage (`calendar-feed-publish-key`), never synced dashboard config. Blank disables publishing.
5. On your laptop, open Clock settings and enter the relay base URL and **read** key. Choose marks, placement, optional agenda, colors, and theme. Copy the URL into the no-input kiosk startup command. All Clock options, including theme and calendar options, are in the link.

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
| `GET /calendar/snapshot` | `Authorization: Bearer CALENDAR_READ_KEY`    | Read events and freshness/coverage metadata |

Unset keys disable their endpoint (503); invalid keys return 401. Responses use `Cache-Control: no-store`. Google credentials never reach relay/Clock.

**The copied URL contains a read-only key: treat it as private.** URLs may appear in browser history, startup files, or hosting logs. Clock suppresses referrers and sends the key to the relay in a header, not its request URL. Use HTTPS or a trusted network/VPN. Other home-relay routes remain trusted-network-only; calendar keys do not secure the rest of the service. Rotate the read key/restart to revoke links.

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
