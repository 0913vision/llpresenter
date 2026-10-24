import {getCompileCacheDir} from 'node:module';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {COMPILE_CACHE_DIR} from '../scripts/compile-cache.mts';

// NOTE(0913vision): Vitest sets NODE_DISABLE_COMPILE_CACHE while it measures
// coverage, so the cache is off in `npm run test:coverage` by design.
const COVERAGE_DISABLES_CACHE =
  process.env['NODE_DISABLE_COMPILE_CACHE'] !== undefined;

function normalized(path: string): string {
  return resolve(path).toLowerCase();
}

describe('the compile cache setup', () => {
  it.skipIf(COVERAGE_DISABLES_CACHE)(
    'turns on the compile cache in node test workers',
    () => {
      const active = normalized(getCompileCacheDir() ?? '');
      expect(active.startsWith(normalized(COMPILE_CACHE_DIR))).toBe(true);
    },
  );

  it('keeps the cache under node_modules', () => {
    expect(COMPILE_CACHE_DIR.replaceAll('\\', '/')).toMatch(
      /\/node_modules\/\.cache\/node-compile-cache$/,
    );
  });
});
