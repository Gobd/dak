import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'openapi.json',
  output: 'src/generated',
  plugins: [
    {
      name: '@hey-api/client-fetch',
      baseUrl: false,
    },
  ],
});
