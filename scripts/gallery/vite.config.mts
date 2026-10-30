import {resolve} from 'node:path';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const DEFAULT_DEV_PORT = 5173;
const LOOPBACK_HOST = '127.0.0.1';

/** The aliases of the renderer build, so gallery imports resolve the same way. */
export const RENDERER_ALIASES = {
  '@core': resolve(REPO_ROOT, 'src/core'),
  '@contracts': resolve(REPO_ROOT, 'src/contracts'),
  '@renderer': resolve(REPO_ROOT, 'src/renderer/src'),
};

/** The port the gallery listens on: `LLP_DEV_PORT`, as for the dev server. */
export function galleryPort(env: NodeJS.ProcessEnv): number {
  return Number(env['LLP_DEV_PORT'] ?? DEFAULT_DEV_PORT);
}

// NOTE(0913vision): electron-vite 6.0.0 starts Electron even with
// --rendererOnly, which put a control window on the user's screen. Plain Vite
// can't start Electron. It listens on the loopback address only, so the
// Windows firewall never asks, and it never opens a browser.
export default defineConfig({
  root: resolve(REPO_ROOT, 'src/renderer'),
  resolve: {alias: RENDERER_ALIASES},
  plugins: [react()],
  server: {
    port: galleryPort(process.env),
    strictPort: true,
    host: LOOPBACK_HOST,
    open: false,
  },
});
