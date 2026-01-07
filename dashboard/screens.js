/*
 * Dashboard Configuration
 *
 * CONFIG OPTIONS:
 *   background    - Dashboard background color (default: '#111')
 *   navPosition   - Button position: 'bottom-right', 'bottom-left', 'top-right', 'top-left'
 *   navButtons    - Which nav buttons to show:
 *                   'both' = prev + next buttons
 *                   'next' = next button only
 *                   'prev' = prev button only
 *                   'none' = no buttons (swipe only)
 *   navColor      - Button text/arrow color
 *   navBackground - Button background color
 *
 * PANEL OPTIONS:
 *   src     - URL to load in the panel iframe
 *   args    - Object of query params passed to src (e.g., { lat: '34.7', lon: '-119.3' })
 *   x, y    - Position as percentage (e.g., '0%', '50%')
 *   w, h    - Size as percentage (e.g., '100%', '50%')
 *   refresh - Auto-refresh interval: '30s', '1m', '5m', '30m', '1h', etc.
 *   css     - Additional CSS to apply to panel
 *
 * URL PARAMS:
 *   ?edit       - Enter edit mode
 *   ?screen=N   - Start on screen N (0-indexed)
 *   ?edit&screen=1 - Both work together
 *
 * EDIT MODE:
 *   - Drag panels to move (snaps to 5% grid)
 *   - Drag corners/edges to resize
 *   - Double-click panel to edit settings (URL, args, refresh)
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
     * ┌─────────────────┐
     * │                 │
     * │     weather     │
     * │                 │
     * └─────────────────┘
     */
    {
      id: 'weather-test',
      panels: [
        {
          src: '/widgets/weather.html',
          args: { lat: '34.70083', lon: '-119.31778' },
          x: '0%',
          y: '0%',
          w: '100%',
          h: '100%',
          refresh: '30m',
        },
      ],
    },

    /*
     * ┌───────┬───────────────┐
     * │       │               │
     * │       │    health     │
     * │ notes │               │
     * │       ├───────────────┤
     * │       │    weather    │
     * └───────┴───────────────┘
     */
    {
      id: 'notes-health-weather',
      panels: [
        // left half, full height - notes
        {
          src: 'https://bkemper.me/dak/notes-app/',
          x: '0%',
          y: '0%',
          w: '50%',
          h: '100%',
        },
        // top-right 65% - health tracker
        {
          src: 'https://bkemper.me/dak/health-tracker/',
          x: '50%',
          y: '0%',
          w: '50%',
          h: '65%',
        },
        // bottom-right 35% - weather widget
        {
          src: '/widgets/weather.html',
          args: { lat: '34.70083', lon: '-119.31778' },
          x: '50%',
          y: '65%',
          w: '50%',
          h: '35%',
          refresh: '30m',
        },
      ],
    },

    /*
     * ┌─────────────────┐
     * │     chores      │
     * ├────────┬────────┤
     * │ health │ weather│
     * └────────┴────────┘
     */
    {
      id: 'chores-health-weather',
      panels: [
        // top half, full width - chores
        {
          src: 'https://bkemper.me/dak/family-chores/',
          x: '0%',
          y: '0%',
          w: '100%',
          h: '50%',
        },
        // bottom-left quarter - health
        {
          src: 'https://bkemper.me/dak/health-tracker/',
          x: '0%',
          y: '50%',
          w: '50%',
          h: '50%',
        },
        // bottom-right quarter - weather
        {
          src: '/widgets/weather.html',
          args: { lat: '34.70083', lon: '-119.31778' },
          x: '50%',
          y: '50%',
          w: '50%',
          h: '50%',
          refresh: '30m',
        },
      ],
    },
  ],
};
