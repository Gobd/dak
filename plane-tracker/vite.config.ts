import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/plane-tracker/',
  port: 5182,
  pwa: {
    name: 'Plane Tracker',
    short_name: 'Planes',
    description: 'Nearby aircraft geofence alerts',
    orientation: 'portrait',
    includeAssets: ['icon.svg'],
  },
});
