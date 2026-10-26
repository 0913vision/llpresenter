import {describe, expect, it} from 'vitest';
import {parseScreenId} from './ids';

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
