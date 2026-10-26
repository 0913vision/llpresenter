import {describe, expect, it} from 'vitest';
import {audioMutedByDefault} from './audioPolicy';

describe('audioMutedByDefault', () => {
  it.each([
    {},
    {NODE_ENV: 'production'},
    {ELECTRON_RENDERER_URL: 'http://localhost:5182'},
  ])('mutes every unpackaged run: %j', env =>
    expect(audioMutedByDefault(env, false)).toBe(true),
  );
  it.each([
    {NODE_ENV: 'test'},
    {VITEST: 'true'},
    {LLP_TEST_WINDOWS: 'offscreen'},
    {LLP_TEST_WINDOWS: ''},
  ])('also mutes a packaged test run: %j', env =>
    expect(audioMutedByDefault(env, true)).toBe(true),
  );
  it('allows sound only for a packaged service run', () => {
    expect(audioMutedByDefault({NODE_ENV: 'production'}, true)).toBe(false);
  });
});
