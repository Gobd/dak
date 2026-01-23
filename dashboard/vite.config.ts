import { createViteConfig } from '@dak/vite-shared-react';
import { resolve } from 'path';

export default createViteConfig({
  base: '/dashboard/',
  port: 8080,
  rollupInput: {
    main: resolve(import.meta.dirname!, 'index.html'),
    privacy: resolve(import.meta.dirname!, 'privacy.html'),
  },
});
