import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';
import {build} from 'vite';
import {expect, it, onTestFinished} from 'vitest';
import {runStepProcess} from '../../../scripts/verify/step-process.mts';
import {electronTestArgs} from '../../../test/electron-launch';
import {makeTempDir} from '../../../test/temp-dir';
import {
  ELECTRON_STARTUP_DEADLINE_MS,
  PIXEL_CHECK_DEADLINE_MS,
  SYNTAX_CHECK_DEADLINE_MS,
  ownPixelFixture,
} from '../windows/fixtures/pixelFixtureLifecycle.mts';

const PROCESS_DEADLINE_MS =
  ELECTRON_STARTUP_DEADLINE_MS + PIXEL_CHECK_DEADLINE_MS + 10_000;
const TEST_DEADLINE_MS =
  PROCESS_DEADLINE_MS + SYNTAX_CHECK_DEADLINE_MS + 60_000;
const WINDOWS_CI =
  process.platform === 'win32' &&
  process.env['GITHUB_ACTIONS'] === 'true' &&
  process.env['RUNNER_OS'] === 'Windows';

it.skipIf(!WINDOWS_CI)(
  'records native Windows fullscreen exit order and keeps the corrected placement',
  {timeout: TEST_DEADLINE_MS},
  async () => {
    const root = await makeTempDir();
    const outDir = join(root, 'main');
    await build({
      configFile: false,
      logLevel: 'silent',
      ssr: {noExternal: true, external: ['electron']},
      build: {
        ssr: resolve('src/main/outputs/fixtures/fullscreenOrder.mts'),
        outDir,
        rolldownOptions: {
          external: ['electron', /^node:/],
          output: {format: 'cjs', entryFileNames: 'index.cjs'},
        },
      },
    });
    const main = join(outDir, 'index.cjs');
    const userData = join(root, 'user-data');
    await mkdir(userData);
    const binary: unknown = createRequire(import.meta.url)('electron');
    if (typeof binary !== 'string') throw new Error('Expected Electron binary');
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !['node_options', 'electron_run_as_node'].includes(key.toLowerCase()),
      ),
    );
    const syntax = await runStepProcess({
      name: 'native fullscreen fixture syntax',
      file: process.execPath,
      args: ['--check', main],
      env,
      deadlineMs: SYNTAX_CHECK_DEADLINE_MS,
      interrupt: new AbortController().signal,
    });
    expect(syntax.exitCode, syntax.output).toBe(0);
    const fixture = ownPixelFixture(interrupt =>
      runStepProcess({
        name: 'native fullscreen order',
        file: binary,
        args: electronTestArgs([main, userData]),
        env: {...env, LLP_NATIVE_PLACEMENT_CI: '1'},
        deadlineMs: PROCESS_DEADLINE_MS,
        interrupt,
      }),
    );
    onTestFinished(() => fixture.stop());
    try {
      const result = await fixture.running;
      const coverage = resolve('coverage');
      await mkdir(coverage, {recursive: true});
      await writeFile(
        join(coverage, 'native-fullscreen-order.log'),
        result.output,
      );
      console.log(result.output);
      expect(result.exitCode, result.output).toBe(0);
      expect(result.stoppedBy, result.output).toBeNull();
      expect(result.leftRunning, result.output).toBe(false);
      expect(result.output).toContain('FULLSCREEN_ORDER ');
      expect(result.output).toContain('after-setFullScreen-return');
      expect(result.output).toContain('native fullscreen placement passed');
    } finally {
      await fixture.stop();
    }
  },
);
