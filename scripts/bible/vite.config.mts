import {resolve} from 'node:path';
import {defineConfig} from 'vite';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(REPO_ROOT, 'src/core'),
      '@contracts': resolve(REPO_ROOT, 'src/contracts'),
    },
  },
  build: {
    ssr: resolve(import.meta.dirname, 'main.ts'),
    target: 'node24',
    outDir: resolve(REPO_ROOT, '.llp/bible-converter'),
    emptyOutDir: false,
    rolldownOptions: {output: {entryFileNames: 'main.mjs'}},
  },
});
