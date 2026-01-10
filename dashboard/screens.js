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
 *                args: { lat, lon, layout: 'horizontal'|'vertical' }
 *   uv         - UV Index chart (Open-Meteo, free)
 *                args: { lat, lon }
 *   aqi        - Air Quality Index chart (Open-Meteo, free)
 *                args: { lat, lon }
 *   drive-time - Floating commute time overlay (via Cloudflare Functions → Google Distance Matrix)
 *                API key is server-side in Cloudflare env var GOOGLE_MAPS_API_KEY
 *                args: { routes, dark }
 *                - routes: array of route configs (origin, destination, days, etc.)
 *                - origin/destination: location keys (addresses stored in localStorage)
 *                - days: ['tue', 'thu'] (default) - which days to show
 *                - startTime/endTime: 24hr format, e.g. '5:30', '7:30' (default 5:30-7:30)
 *                - label: optional text label
 *                - minTimeToShow: e.g. '25m', '1h' - only show if drive time exceeds threshold
 *                Shows traffic warnings when commute is 1.4x-2.5x+ normal
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
     * Screen 1: Calendar + Notes + Drive Time overlay
     * ┌───────┬───────────────┐
     * │       │  [drive-time] │
     * │ notes │   calendar    │
     * │       │               │
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
          x: '30%',
          y: '0%',
          w: '70%',
          h: '100%',
          refresh: '5m',
        },
        // Drive time overlay - floats on top of calendar
        // Routes defined here with location keys, actual addresses in localStorage
        // Click overlay to manage addresses (with Google Places autocomplete)
        {
          type: 'drive-time',
          args: {
            dark: true,
            routes: [
              // Parent 1: home → workA on Tue/Thu mornings
              {
                origin: 'home',
                destination: 'workA',
                days: ['tue', 'thu'],
                startTime: '5:30',
                endTime: '7:30',
                label: 'Dad → Office',
                minTimeToShow: '25m', // Only show if drive time > 25 minutes
              },
              // Parent 2: home → workB on Mon/Wed/Fri mornings
              // {
              //   origin: 'home',
              //   destination: 'workB',
              //   days: ['mon', 'wed', 'fri'],
              //   startTime: '6:00',
              //   endTime: '8:00',
              //   label: 'Mom → Office',
              // },
            ],
          },
          x: '30%',
          y: '15%',
          w: '70%',
          h: '85%',
        },
      ],
    },

    /*
     * Screen 2: Weather + UV + AQI + Health Tracker
     * ┌───────┬───────────────┐
     * │weather│               │
     * ├───────┤    health     │
     * │ UV    │               │
     * ├───────┤               │
     * │ AQI   │               │
     * └───────┴───────────────┘
     */
    {
      id: 'weather-health',
      panels: [
        {
          type: 'weather',
          args: {
            lat: '40.7608', // Salt Lake City, UT - update for your location
            lon: '-111.8910',
            layout: 'vertical',
          },
          x: '0%',
          y: '0%',
          w: '30%',
          h: '80%',
          refresh: '30m',
        },
        {
          type: 'uv',
          args: {
            lat: '40.7608',
            lon: '-111.8910',
            safeThreshold: 4,
          },
          x: '0%',
          y: '80%',
          w: '30%',
          h: '10%',
          refresh: '30m',
        },
        {
          type: 'aqi',
          args: {
            lat: '40.7608',
            lon: '-111.8910',
          },
          x: '0%',
          y: '90%',
          w: '30%',
          h: '10%',
          refresh: '30m',
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
