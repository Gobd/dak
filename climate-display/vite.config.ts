import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/climate-display/',
  port: 5178,
  pwa: {
    name: 'Climate Display',
    short_name: 'Climate',
    description: 'Indoor/outdoor climate comparison',
    orientation: 'portrait',
    includeAssets: ['icon.svg'],
  },
});
