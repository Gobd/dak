import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/kasa-controller/',
  port: 5177,
  pwa: {
    name: 'Kasa Controller',
    short_name: 'Kasa',
    description: 'Control your Kasa smart devices',
    orientation: 'portrait',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
  },
});
