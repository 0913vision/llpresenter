import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';
import {build} from 'vite';
import {expect, it} from 'vitest';
import {runStepProcess} from '../../../../scripts/verify/step-process.mts';
import {makeTempDir} from '../../../../test/temp-dir';

const FIXTURE_ROOT = resolve('src/renderer/src/render/fixtures');
const FIXTURE_MAIN = resolve(
  'src/main/windows/fixtures/transparentBackground.mts',
);
const DEADLINE_MS = 30_000;

it('dissolves transparent PNG pixels against the output background before outgoing cleanup', async () => {
  const root = await makeTempDir();
  const outDir = join(root, 'renderer');
  await build({
    root: FIXTURE_ROOT,
    configFile: false,
    base: './',
    logLevel: 'silent',
    build: {
      outDir,
      emptyOutDir: true,
      rolldownOptions: {
        input: join(FIXTURE_ROOT, 'transparentBackground.html'),
      },
    },
  });
  const userData = join(root, 'user-data');
  await mkdir(userData);
  const binary: unknown = createRequire(import.meta.url)('electron');
  if (typeof binary !== 'string') {
    throw new Error('Expected the Electron binary');
  }
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !['node_options', 'electron_run_as_node'].includes(key.toLowerCase()),
    ),
  );
  const syntax = await runStepProcess({
    name: 'transparent PNG fixture syntax',
    file: process.execPath,
    args: ['--check', FIXTURE_MAIN],
    env,
    deadlineMs: DEADLINE_MS,
    interrupt: new AbortController().signal,
  });
  expect(syntax.exitCode, syntax.output).toBe(0);
  const result = await runStepProcess({
    name: 'transparent PNG regression',
    file: binary,
    args: [FIXTURE_MAIN, join(outDir, 'transparentBackground.html'), userData],
    env: {...env, LLP_TEST_WINDOWS: 'offscreen'},
    deadlineMs: DEADLINE_MS,
    interrupt: new AbortController().signal,
  });
  expect(result.exitCode, result.output).toBe(0);
  expect(result.stoppedBy, result.output).toBeNull();
  expect(result.leftRunning, result.output).toBe(false);
  expect(result.output).toContain('transparent background regression passed');
});
