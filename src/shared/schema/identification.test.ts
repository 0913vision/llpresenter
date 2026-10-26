import {describe, expect, it} from 'vitest';
import {parseIdentification} from './identification';

const DETAILS = {
  name: 'Main screen',
  kind: 'audience',
  method: 'fullscreen',
  width: 1920,
  height: 1080,
  refreshRate: 59.94,
};

describe('parseIdentification', () => {
  it('accepts bounded output details and drops unknown fields', () => {
    expect(parseIdentification({...DETAILS, extra: true})).toEqual({
      ok: true,
      value: DETAILS,
    });
    expect(
      parseIdentification({
        ...DETAILS,
        kind: null,
        method: 'display',
        refreshRate: 0,
      }).ok,
    ).toBe(true);
  });

  it.each([
    {name: 'x'.repeat(201)},
    {width: 0},
    {height: 1_000_001},
    {width: 1.5},
    {refreshRate: Infinity},
    {refreshRate: -1},
    {refreshRate: 1001},
    {kind: 'unknown'},
    {method: 'ndi'},
  ])('rejects invalid or oversized details %j', change => {
    expect(parseIdentification({...DETAILS, ...change}).ok).toBe(false);
  });
});
