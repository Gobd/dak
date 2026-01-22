import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'openapi.json',
  output: 'src/generated',
  plugins: ['@hey-api/client-fetch'],
});
