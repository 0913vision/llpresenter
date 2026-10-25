import {resolve} from 'node:path';
import {configDefaults, defineConfig} from 'vitest/config';

/**
 * Renderer tests that need Node's APIs, such as one that reads the design
 * system's files, run in the node project instead of jsdom.
 */
export const RENDERER_NODE_TESTS = 'src/renderer/**/*.node.test.ts';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src'),
    },
  },
  test: {
    // NOTE(0913vision): Several sessions run tests on one PC at once. With a
    // worker per core, workers missed Vitest's fixed 60 s start timeout and
    // whole files didn't run; half the cores makes them slower, not lost.
    maxWorkers: '50%',
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
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,mts}', 'scripts/**/*.{ts,mts}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: [
            'src/main/**/*.test.ts',
            'src/preload/**/*.test.ts',
            'src/shared/**/*.test.ts',
            'scripts/**/*.test.ts',
            'test/**/*.test.ts',
            RENDERER_NODE_TESTS,
          ],
          environment: 'node',
          setupFiles: ['test/setup-compile-cache.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, RENDERER_NODE_TESTS],
          environment: 'jsdom',
          setupFiles: ['test/setup-compile-cache.ts', 'test/setup-renderer.ts'],
        },
      },
    ],
  },
});
