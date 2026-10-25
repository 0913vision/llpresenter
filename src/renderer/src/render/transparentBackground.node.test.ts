import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';
import {build} from 'vite';
import {expect, it, onTestFinished} from 'vitest';
import {
  PIXEL_FIXTURE_PROCESS_DEADLINE_MS,
  PIXEL_FIXTURE_TEST_DEADLINE_MS,
  SYNTAX_CHECK_DEADLINE_MS,
  ownPixelFixture,
} from '../../../main/windows/fixtures/pixelFixtureLifecycle.mts';
import {runStepProcess} from '../../../../scripts/verify/step-process.mts';
import {makeTempDir} from '../../../../test/temp-dir';
import {electronTestArgs} from '../../../../test/electron-launch';

const FIXTURE_ROOT = resolve('src/renderer/src/render/fixtures');
const FIXTURE_MAIN = resolve(
  'src/main/windows/fixtures/transparentBackground.mts',
);

it(
  'dissolves transparent PNG pixels against the output background before outgoing cleanup',
  {timeout: PIXEL_FIXTURE_TEST_DEADLINE_MS},
  async () => {
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
      deadlineMs: SYNTAX_CHECK_DEADLINE_MS,
      interrupt: new AbortController().signal,
    });
    expect(syntax.exitCode, syntax.output).toBe(0);
    const fixture = ownPixelFixture(interrupt =>
      runStepProcess({
        name: 'transparent PNG regression',
        file: binary,
        args: electronTestArgs([
          FIXTURE_MAIN,
          join(outDir, 'transparentBackground.html'),
          userData,
        ]),
        env: {...env, LLP_TEST_WINDOWS: 'offscreen'},
        deadlineMs: PIXEL_FIXTURE_PROCESS_DEADLINE_MS,
        interrupt,
      }),
    );
    onTestFinished(() => fixture.stop());
    try {
      const result = await fixture.running;
      expect(result.exitCode, result.output).toBe(0);
      expect(result.stoppedBy, result.output).toBeNull();
      expect(result.leftRunning, result.output).toBe(false);
      expect(result.output).toContain(
        'transparent background regression passed',
      );
    } finally {
      await fixture.stop();
    }
  },
);
