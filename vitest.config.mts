import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';

// TODO(0913vision): The devops member extends this with coverage, test
// helpers, and separate main and renderer projects.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
