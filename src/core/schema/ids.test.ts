import {describe, expect, it} from 'vitest';
import {
  parseScreenId,
  parseLyricStyleId,
  createThemeId,
  createThemeElementId,
  createItemOverlayId,
} from './ids';

it.each([createThemeId, createThemeElementId, createItemOverlayId])(
  'validates new theme-domain IDs with %s',
  create => {
    const id = '00000000-0000-4000-8000-000000000301';
    expect(create(id)).toBe(id);
    for (const invalid of [
      '',
      'missing',
      '00000000-0000-1000-8000-000000000301',
      `${id}x`,
    ]) {
      expect(() => create(invalid)).toThrow();
    }
  },
);

it('validates generated lyric style IDs', () => {
  const value = '00000000-0000-4000-8000-000000000301';
  expect(parseLyricStyleId(value)).toEqual({ok: true, value});
  expect(parseLyricStyleId('invalid').ok).toBe(false);
  expect(parseLyricStyleId(null).ok).toBe(false);
});

describe('parseScreenId', () => {
  it('accepts a lowercase v4 screen UUID', () => {
    const value = '00000000-0000-4000-8000-000000000201';
    expect(parseScreenId(value)).toEqual({ok: true, value});
  });

  it.each([
    'main',
    '00000000-0000-1000-8000-000000000201',
    '',
    null,
    '00000000-0000-4000-8000-00000000020A',
    'x'.repeat(1000),
  ])('rejects malformed ids %j', value => {
    expect(parseScreenId(value).ok).toBe(false);
  });
});
