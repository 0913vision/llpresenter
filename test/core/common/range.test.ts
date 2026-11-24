import {describe, expect, it} from 'vitest';
import {clamp} from '@core/common/range';

const range = {min: 0, max: 10};

describe('clamp', () => {
  it('snaps values to the nearest end of the range', () => {
    expect(clamp(-1, range)).toBe(0);
    expect(clamp(11, range)).toBe(10);
    expect(clamp(5, range)).toBe(5);
    expect(clamp(0.1, {min: 0.12, max: 0.28})).toBe(0.12);
    expect(clamp(0.3, {min: 0.12, max: 0.28})).toBe(0.28);
  });

  const widths = {min: 200, max: 400};

  it('keeps values on the range boundaries', () => {
    expect(clamp(200, widths)).toBe(200);
    expect(clamp(400, widths)).toBe(400);
  });

  it('pulls values outside the range to the nearest boundary', () => {
    expect(clamp(199, widths)).toBe(200);
    expect(clamp(401, widths)).toBe(400);
  });
});
