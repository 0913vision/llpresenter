import {describe, expect, it, vi} from 'vitest';
import {electronTestArgs} from './electron-launch';

const APP_ARGS = ['fixture.mts', 'isolated-user-data'];

describe('electronTestArgs', () => {
  it('keeps fixture arguments in place when selecting the CPU ANGLE driver', () => {
    expect(electronTestArgs(APP_ARGS, {GITHUB_ACTIONS: 'true'})).toEqual([
      ...APP_ARGS,
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ]);
    expect(APP_ARGS).toEqual(['fixture.mts', 'isolated-user-data']);
  });

  it.each([{}, {GITHUB_ACTIONS: 'false'}, {CI: 'true'}])(
    'preserves the normal test launch outside GitHub (%j)',
    env => {
      expect(electronTestArgs(APP_ARGS, env)).toEqual(APP_ARGS);
    },
  );

  it('reads the current test process environment by default', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    expect(electronTestArgs(APP_ARGS)).toContain('--use-angle=swiftshader');
  });
});
