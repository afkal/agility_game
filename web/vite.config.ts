import { defineConfig } from 'vitest/config';
import { studioPlugin } from './tools/studio-plugin.ts';

export default defineConfig({
  plugins: [studioPlugin()],
  build: {
    chunkSizeWarningLimit: 1600,
  },
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
