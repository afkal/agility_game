import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    // The API server runs separately in development (`npm run server`).
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
