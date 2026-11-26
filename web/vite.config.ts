import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // Phaser alone is about 1.4 MB; it loads only when a level starts.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    // The API server runs separately in development (`npm run server`).
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
