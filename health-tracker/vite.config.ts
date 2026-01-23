import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/health-tracker/',
  port: 5173,
  pwa: {
    name: 'Health Tracker',
    short_name: 'Health',
    description: 'Family health tracking app',
  },
});
