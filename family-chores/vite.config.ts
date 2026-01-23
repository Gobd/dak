import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/family-chores/',
  port: 5174,
  pwa: {
    name: 'Family Chores',
    short_name: 'Chores',
    description: 'Family chore tracking with points',
    orientation: 'any',
  },
});
