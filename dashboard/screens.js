/*
 * Dashboard Configuration
 *
 * This is the DEFAULT configuration. Users configure their own dashboard via
 * Edit Mode (?edit) and changes are stored in browser localStorage.
 * Use Export to backup your config as a JSON file.
 *
 * CONFIG OPTIONS:
 *   background    - Dashboard background color (default: '#111')
 *   dark          - Enable dark mode for all panels/widgets (default: true)
 *   navPosition   - Button position: 'bottom-right', 'bottom-left', 'top-right', 'top-left'
 *   navButtons    - Which nav buttons to show:
 *                   'both' = prev + next buttons
 *                   'next' = next button only
 *                   'prev' = prev button only
 *                   'none' = no buttons
 *   navColor      - Button text/arrow color
 *   navBackground - Button background color
 *
 * PANEL OPTIONS:
 *   type    - Widget type: 'calendar', 'weather', 'iframe' (or omit for iframe)
 *   src     - URL for iframe panels
 *   args    - Widget-specific options or iframe query params
 *   x, y    - Position as percentage (e.g., '0%', '50%')
 *   w, h    - Size as percentage (e.g., '100%', '50%')
 *   refresh - Auto-refresh interval: '30s', '1m', '5m', '30m', '1h', etc.
 *   css     - Additional CSS to apply to panel
 *
 * WIDGET TYPES:
 *   calendar   - Google Calendar (OAuth login, shows your calendars)
 *   weather    - NWS Weather forecast
 *                args: { layout: 'horizontal'|'vertical' }
 *                Location configured via settings button (defaults to San Francisco)
 *   uv         - UV Index chart (Open-Meteo, free)
 *                args: { safeThreshold: number }
 *                Location configured via settings button (defaults to San Francisco)
 *   aqi        - Air Quality Index chart (Open-Meteo, free)
 *                Location configured via settings button (defaults to San Francisco)
 *   drive-time - Floating commute time overlay (via Cloudflare Functions → Google Distance Matrix)
 *                API key is server-side in Cloudflare env var GOOGLE_MAPS_API_KEY
 *                args: { dark }
 *                Routes are configured via UI and stored in localStorage
 *                Click the car icon to add/edit routes with:
 *                - Origin/destination locations with Google Places autocomplete
 *                - Days of week and time window
 *                - Optional label and minimum time threshold
 *                Shows traffic warnings when commute is 1.4x-2.5x+ normal
 *                Shows route count (active/total) on the icon
 *   sun-moon   - Sunrise/sunset times, day length change, moon phase
 *                Location configured via settings button (defaults to San Francisco)
 *                Shows: sunrise/sunset, day length (+/- from yesterday), moon phase (growing/shrinking), days to full moon
 *   kasa       - Kasa smart device toggles (auto-discovers devices on LAN)
 *                Requires home-relay service running on localhost:5111
 *   wol        - Wake on LAN (click to open modal, configure devices)
 *                Requires home-relay service running on localhost:5111
 *   brightness - Auto-brightness settings (sunrise/sunset based dimming)
 *                Configure location, day/night levels, transition time
 *                Requires home-relay service running on localhost:5111
 *   iframe     - Any URL (default if type not specified but src is)
 *
 * URL PARAMS:
 *   ?edit       - Enter edit mode
 *   ?screen=N   - Start on screen N (0-indexed)
 *   ?local      - Use localhost URLs for iframes (for development)
 *   ?edit&screen=1&local - All work together
 *
 * EDIT MODE:
 *   - Drag panels to move (snaps to 5% grid)
 *   - Drag corners/edges to resize
 *   - Double-click panel to edit settings
 *   - Changes auto-save to localStorage
 *   - Export/Import JSON for backup
 *   - Reset returns to these defaults
 */

export default {
  config: {
    background: '#111',
    dark: true,
    navPosition: 'bottom-right',
    navButtons: 'both',
    navColor: 'rgba(255, 255, 255, 0.6)',
    navBackground: 'rgba(255, 255, 255, 0.1)',
  },

  screens: [
    /*
     * Screen 1: Calendar + Notes + Drive Time + Home Controls overlay
     * ┌───────┬───────────────┐
     * │       │[kasa][wol][☀] │
     * │ notes │   calendar    │
     * │       │  [drive-time] │
     * └───────┴───────────────┘
     */
    {
      id: 'calendar-notes',
      panels: [
        {
          type: 'iframe',
          src: '/notes-app/',
          x: '0%',
          y: '0%',
          w: '30%',
          h: '100%',
        },
        {
          type: 'calendar',
          args: {
            showTime: true,
          },
          x: '30%',
          y: '0%',
          w: '70%',
          h: '100%',
          refresh: '5m',
        },
        // Home control overlays - float at top of calendar (left of time)
        {
          type: 'kasa',
          x: '78%',
          y: '1%',
          w: '5%',
          h: '4%',
        },
        {
          type: 'wol',
          x: '83%',
          y: '1%',
          w: '5%',
          h: '4%',
        },
        {
          type: 'brightness',
          x: '88%',
          y: '1%',
          w: '5%',
          h: '4%',
        },
        // Drive time overlay - floats on top of calendar
        // Routes configured via UI, stored in localStorage
        {
          type: 'drive-time',
          args: { dark: true },
          x: '30%',
          y: '37%',
          w: '70%',
          h: '63%',
        },
      ],
    },

    /*
     * Screen 2: Weather + UV + AQI + Sun/Moon + Health Tracker
     * ┌───────┬───────────────┐
     * │weather│               │
     * ├───────┤               │
     * │ UV    │    health     │
     * ├───────┤               │
     * │ AQI   │               │
     * ├───────┤               │
     * │sun/moo│               │
     * └───────┴───────────────┘
     *
     * Location is configured via the settings button on each widget.
     * Click the gear icon to set your city/state or ZIP code.
     * Location defaults to San Francisco if not configured.
     */
    {
      id: 'weather-health',
      panels: [
        {
          type: 'weather',
          args: {
            layout: 'vertical',
          },
          x: '0%',
          y: '0%',
          w: '30%',
          h: '68%',
          refresh: '30m',
        },
        {
          type: 'uv',
          args: {
            safeThreshold: 4,
          },
          x: '0%',
          y: '68%',
          w: '30%',
          h: '10%',
          refresh: '30m',
        },
        {
          type: 'aqi',
          args: {},
          x: '0%',
          y: '78%',
          w: '30%',
          h: '10%',
          refresh: '30m',
        },
        {
          type: 'sun-moon',
          args: {},
          x: '0%',
          y: '88%',
          w: '30%',
          h: '12%',
          refresh: '1h',
        },
        {
          type: 'iframe',
          src: '/health-tracker/',
          x: '30%',
          y: '0%',
          w: '70%',
          h: '100%',
        },
      ],
    },
  ],
};
