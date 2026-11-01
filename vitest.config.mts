import {resolve} from 'node:path';
import {configDefaults, defineConfig} from 'vitest/config';

/**
 * Renderer tests that need Node's APIs, such as one that reads the design
 * system's files, run in the node project instead of jsdom.
 */
export const RENDERER_NODE_TESTS = 'test/renderer/**/*.node.test.ts';

/** Keep local concurrent verification bounded; CI shards run on separate runners. */
export function testWorkerLimit(env: NodeJS.ProcessEnv): '50%' | '100%' {
  return env['LLP_CI_TEST_WORKERS'] === '1' ? '100%' : '50%';
}

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve('src/core'),
      '@contracts': resolve('src/contracts'),
      '@renderer': resolve('src/renderer/src'),
      '@main': resolve('src/main'),
      '@fixtures': resolve('test/fixtures'),
    },
  },
  test: {
    // NOTE(0913vision): Several sessions run tests on one PC at once. With a
    // worker per core, workers missed Vitest's fixed 60 s start timeout and
    // whole files didn't run; half the cores makes them slower, not lost.
    maxWorkers: testWorkerLimit(process.env),
    // NOTE(0913vision): Worker threads start much cheaper than forked
    // processes on Windows, and forks missed that start timeout under load
    // (bug M1-7). Alternating runs here took 55 to 72 s with threads against
    // 71 to 109 s with forks.
    pool: 'threads',
    // NOTE(0913vision): The 5 s default failed a test that spawns git when
    // seven sessions built at once (M1-7). A slow machine must slow the gate
    // down, not fail it; a hung test still fails.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // NOTE(0913vision): Each test starts from real timers, real globals, and
    // fresh mocks, so no test depends on the one before it.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // NOTE(0913vision): The module cache keys a transformed file by its own
    // content, so an eager import.meta.glob stays expanded to the files that
    // existed when it was cached. The live slice registry then lost every
    // slice added since M2 in local runs, while CI, which starts clean,
    // passed.
    fsModuleCache: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,mts}'],
      exclude: ['**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: [
            'scripts/**/*.test.ts',
            'test/*.test.ts',
            'test/setup/*.test.ts',
            'test/fixtures/*.test.ts',
            'test/integration/**/*.test.ts',
            'test/ui/**/*.test.ts',
            'test/{core,contracts,main,preload}/**/*.test.ts',
            'test/fixtures/{core,contracts,main,preload}/**/*.test.ts',
            RENDERER_NODE_TESTS,
          ],
          environment: 'node',
          setupFiles: ['test/setup/compileCache.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          include: [
            'test/renderer/**/*.test.{ts,tsx}',
            'test/fixtures/renderer/**/*.test.{ts,tsx}',
            'test/integration/**/*.test.tsx',
          ],
          exclude: [...configDefaults.exclude, RENDERER_NODE_TESTS],
          environment: 'jsdom',
          setupFiles: ['test/setup/compileCache.ts', 'test/setup/renderer.ts'],
        },
      },
    ],
  },
});
