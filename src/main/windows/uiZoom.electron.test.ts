import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';
import react from '@vitejs/plugin-react';
import {build} from 'vite';
import {expect, it, onTestFinished} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {electronTestArgs} from '../../../test/electron-launch';
import {runStepProcess} from '../../../scripts/verify/step-process.mts';

const STARTUP_MS = 120_000;
const CHECK_MS = 30_000;
const PREPARATION_MS = 60_000;
const SYNTAX_MS = 30_000;
const PROCESS_MS = STARTUP_MS + CHECK_MS + 10_000;
const TEST_MS = PREPARATION_MS + SYNTAX_MS + PROCESS_MS + 10_000;
const MAIN = resolve('src/main/windows/fixtures/uiZoom.mts');
const RENDERER = resolve('src/renderer/src/shell/fixtures/uiZoom');
const SHARED = {'@shared': resolve('src/shared')};

async function buildNodeFixture(
  entry: string,
  directory: string,
  file: string,
): Promise<void> {
  await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {alias: SHARED},
    ssr: {noExternal: true, external: ['electron']},
    build: {
      ssr: entry,
      outDir: directory,
      rolldownOptions: {
        external: ['electron', /^node:/],
        output: {format: 'cjs', entryFileNames: file},
      },
    },
  });
}

async function buildFixture(root: string): Promise<void> {
  await Promise.all([
    buildNodeFixture(MAIN, join(root, 'main'), 'index.cjs'),
    buildNodeFixture(
      resolve('src/preload/index.ts'),
      join(root, 'preload'),
      'index.js',
    ),
    build({
      root: RENDERER,
      configFile: false,
      logLevel: 'silent',
      base: './',
      plugins: [react()],
      resolve: {alias: {...SHARED, '@renderer': resolve('src/renderer/src')}},
      build: {
        outDir: join(root, 'renderer'),
        rolldownOptions: {input: join(RENDERER, 'index.html')},
      },
    }),
  ]);
}

it(
  'keeps IME keys from native zoom roles and repairs native drift when the stored value is already 100',
  {timeout: TEST_MS},
  async () => {
    const root = await makeTempDir();
    await buildFixture(root);
    const binary: unknown = createRequire(import.meta.url)('electron');
    if (typeof binary !== 'string') {
      throw new Error('Expected the Electron binary');
    }
    const userData = join(root, 'user-data');
    await mkdir(userData);
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          ![
            'node_options',
            'electron_run_as_node',
            'electron_renderer_url',
          ].includes(key.toLowerCase()),
      ),
    );
    const main = join(root, 'main', 'index.cjs');
    const syntax = await runStepProcess({
      name: 'UI zoom fixture syntax',
      file: process.execPath,
      args: ['--check', main],
      env,
      deadlineMs: SYNTAX_MS,
      interrupt: new AbortController().signal,
    });
    expect(syntax.exitCode, syntax.output).toBe(0);
    const abort = new AbortController();
    const running = runStepProcess({
      name: 'UI zoom Electron regression',
      file: binary,
      args: electronTestArgs([main, userData]),
      env: {...env, LLP_TEST_WINDOWS: 'offscreen'},
      deadlineMs: PROCESS_MS,
      interrupt: abort.signal,
    });
    const stop = async (): Promise<void> => {
      abort.abort();
      const result = await running;
      if (result.leftRunning) {
        throw new Error('UI zoom fixture left a process running');
      }
    };
    onTestFinished(stop);
    try {
      const result = await running;
      expect(result.exitCode, result.output).toBe(0);
      expect(result.stoppedBy, result.output).toBeNull();
      expect(result.leftRunning, result.output).toBe(false);
      expect(result.output).toContain('UI zoom Electron regression passed');
    } finally {
      await stop();
    }
  },
);
