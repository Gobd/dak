import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/tracker/',
  port: 5174,
  pwa: {
    name: 'Tracker',
    short_name: 'Tracker',
    description: 'Personal consumption tracker',
  },
});
