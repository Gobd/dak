/*
 * Dashboard Configuration
 *
 * This is the DEFAULT configuration. Users configure their own dashboard via
 * Edit Mode (?edit) and changes are stored in browser localStorage.
 * Use Export to backup your config as a JSON file.
 *
 * CONFIG OPTIONS:
 *   background    - Dashboard background color (default: '#111')
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
 *   calendar - Google Calendar (OAuth login, shows your calendars)
 *   weather  - NWS Weather forecast
 *              args: { lat, lon, layout: 'horizontal'|'vertical' }
 *   iframe   - Any URL (default if type not specified but src is)
 *
 * URL PARAMS:
 *   ?edit       - Enter edit mode
 *   ?screen=N   - Start on screen N (0-indexed)
 *   ?edit&screen=1 - Both work together
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
    navPosition: 'bottom-right',
    navButtons: 'both',
    navColor: 'rgba(255, 255, 255, 0.6)',
    navBackground: 'rgba(255, 255, 255, 0.1)',
  },

  screens: [
    /*
     * Screen 1: Calendar + Notes
     * ┌───────┬───────────────┐
     * │       │               │
     * │ notes │   calendar    │
     * │       │               │
     * └───────┴───────────────┘
     */
    {
      id: 'calendar-notes',
      panels: [
        {
          type: 'iframe',
          src: 'https://dak.bkemper.me/notes-app/',
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
      ],
    },

    /*
     * Screen 2: Weather + Health Tracker
     * ┌───────┬───────────────┐
     * │       │               │
     * │weather│    health     │
     * │       │               │
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
          h: '100%',
          refresh: '30m',
        },
        {
          type: 'iframe',
          src: 'https://dak.bkemper.me/health-tracker/',
          x: '30%',
          y: '0%',
          w: '70%',
          h: '100%',
        },
      ],
    },
  ],
};
