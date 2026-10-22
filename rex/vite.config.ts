import { createViteConfig } from '@dak/vite-shared-react';
import { defineConfig, mergeConfig, type UserConfigExport } from 'vite';

const shared = createViteConfig({
  base: '/rex/',
  port: 5183,
  pwa: {
    name: 'Rex Voice',
    short_name: 'Rex',
    description: 'Talk to your agents over your private network',
    orientation: 'portrait',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
  },
}) as UserConfigExport;

export default defineConfig(async (env) => {
  const config = await (typeof shared === 'function' ? shared(env) : shared);
  return mergeConfig(config, {
    server: {
      proxy: { '/rex/api': 'http://127.0.0.1:5184' },
    },
  });
});
