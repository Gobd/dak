import { createViteConfig } from '@dak/vite-shared-react';

export default createViteConfig({
  base: '/recipe-org/',
  port: 5180,
  pwa: {
    name: 'Recipe Organizer',
    short_name: 'Recipes',
    description: 'Organize and manage your recipes with Dewey Decimal classification',
  },
});
