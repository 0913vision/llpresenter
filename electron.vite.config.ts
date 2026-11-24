import {resolve} from 'node:path';
import {copyFileSync, mkdirSync} from 'node:fs';
import {defineConfig} from 'electron-vite';
import type {ResolvedConfig} from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_DEV_PORT = 5173;
let mainOutputDir = resolve('out/main');

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
    build: {
      rolldownOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          powerpointWorker: resolve('src/main/import/pptx/powerpointWorker.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
        },
      },
    },
    plugins: [
      {
        name: 'ndi-utility-files',
        configResolved(config: ResolvedConfig) {
          mainOutputDir = config.build.outDir;
        },
        closeBundle() {
          const target = resolve(mainOutputDir, 'ndi');
          mkdirSync(target, {recursive: true});
          for (const file of [
            'utility.cjs',
            'pacer.cjs',
            'ndi-library.cjs',
            'dirty.cjs',
            'gpu-utility.cjs',
            'd3d.cjs',
          ]) {
            copyFileSync(
              resolve('src/main/outputs/ndi', file),
              resolve(target, file),
            );
          }
          const presenter = resolve(mainOutputDir, 'presenter');
          mkdirSync(presenter, {recursive: true});
          for (const file of [
            'presenter-utility.cjs',
            'd3dPresenter.cjs',
            'transitionClock.cjs',
          ]) {
            copyFileSync(
              resolve('src/main/outputs/presenter', file),
              resolve(presenter, file),
            );
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
    plugins: [
      react(),
      {
        // NOTE(0913vision): A page that loads another page's entry runs that
        // page too: an output window would show the control window.
        name: 'separate-pages',
        generateBundle(_options, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type !== 'chunk' || !chunk.isEntry) continue;
            const other = chunk.imports.find(file => {
              const imported = bundle[file];
              return imported?.type === 'chunk' && imported.isEntry;
            });
            if (other !== undefined) {
              this.error(`${chunk.fileName} loads the page entry ${other}`);
            }
          }
        },
      },
    ],
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
