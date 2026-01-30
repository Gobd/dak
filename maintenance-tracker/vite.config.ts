import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/maintenance-tracker/',
  port: 5176,
  pwa: {
    name: 'Maintenance Tracker',
    short_name: 'Maintenance',
    description: 'Home and car maintenance tracking',
  },
});
