import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/notes-app/',
  port: 5179,
  pwa: {
    name: 'Notes',
    short_name: 'Notes',
    description: 'A simple notes app with rich text editing',
  },
});
