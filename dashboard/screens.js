export default {
  config: {
    navPosition: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
    navColor: 'rgba(255, 255, 255, 0.6)', // button text/arrow color
    navBackground: 'rgba(255, 255, 255, 0.1)', // button background
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
