import {resolve} from 'node:path';
import {copyFileSync, mkdirSync} from 'node:fs';
import {defineConfig} from 'electron-vite';
import react from '@vitejs/plugin-react';

const DEFAULT_DEV_PORT = 5173;

const shared = {
  '@core': resolve('src/core'),
  '@contracts': resolve('src/contracts'),
};

// NOTE(0913vision): Each session gets its own dev server port (the table in
// docs/WORKFLOW.md). strictPort makes a clash fail instead of silently moving.
const devPort = Number(process.env['LLP_DEV_PORT'] ?? DEFAULT_DEV_PORT);

export default defineConfig({
  main: {
    resolve: {alias: shared},
    plugins: [
      {
        name: 'ndi-utility-files',
        closeBundle() {
          const target = resolve('out/main/ndi');
          mkdirSync(target, {recursive: true});
          for (const file of ['utility.cjs', 'ndi-library.cjs', 'dirty.cjs']) {
            copyFileSync(resolve('src/main/ndi', file), resolve(target, file));
          }
        },
      },
    ],
  },
  preload: {
    resolve: {alias: shared},
    build: {externalizeDeps: false},
  },
  renderer: {
    resolve: {
      alias: {...shared, '@renderer': resolve('src/renderer/src')},
    },
    plugins: [react()],
    server: {port: devPort, strictPort: true},
    build: {
      rolldownOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          output: resolve('src/renderer/output.html'),
          analysis: resolve('src/renderer/analysis.html'),
        },
      },
    },
  },
});
