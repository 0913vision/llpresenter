import {describe, expect, it, vi} from 'vitest';
import {
  fitFontSize,
  fitTextInFrame,
  fitsLineLimit,
} from '@renderer/rendering/fitText';

it('keeps four wrapped rows at theme size until the actual frame overflows', () => {
  const measure = (size: number) => ({width: size * 8, height: size * 4 * 1.4});
  expect(fitTextInFrame({size: 84, width: 1000, height: 600}, measure)).toBe(
    84,
  );
  expect(fitTextInFrame({size: 84, width: 1000, height: 300}, measure)).toBe(
    53,
  );
  expect(fitTextInFrame({size: 84, width: 400, height: 600}, measure)).toBe(50);
});

describe('fitFontSize', () => {
  it('floors a scaled fractional style size and keeps the one-pixel minimum', () => {
    expect(fitFontSize((85 * 2) / 3, () => true)).toBe(56);
    expect(fitFontSize(0.5, () => true)).toBe(1);
  });

  it('bounds an overflowing scale and converges for large reference sizes', () => {
    expect(Number.isSafeInteger(fitFontSize(Infinity, () => true))).toBe(true);
    const fits = vi.fn((size: number) => size <= 37);
    expect(fitFontSize(Number.MAX_VALUE, fits)).toBe(37);
    expect(fits.mock.calls.length).toBeLessThanOrEqual(55);
    expect(fitFontSize(NaN, () => true)).toBe(1);
  });
  it('keeps the style size when the text fits', () => {
    const fits = vi.fn(() => true);
    expect(fitFontSize(84, fits)).toBe(84);
    expect(fits).toHaveBeenCalledTimes(1);
  });

  it('finds the largest whole size that fits', () => {
    expect(fitFontSize(84, size => size <= 41)).toBe(41);
    expect(fitFontSize(84, size => size <= 83)).toBe(83);
  });

  it('keeps shrinking an oversized 장 below a quarter of the style size until it fits', () => {
    expect(fitFontSize(84, size => size <= 3)).toBe(3);
  });

  it('gives the smallest size when nothing fits', () => {
    expect(fitFontSize(84, () => false)).toBe(1);
  });

  it('tries only a few sizes', () => {
    const fits = vi.fn((size: number) => size <= 50);
    fitFontSize(84, fits);
    expect(fits.mock.calls.length).toBeLessThanOrEqual(9);
  });
});

it('fits a long wrapped title to two line boxes at the fitted size', () => {
  const size = fitFontSize(140, candidate => {
    const lines = candidate > 80 ? 3 : 2;
    return fitsLineLimit(lines * candidate * 1.19, candidate, {
      lineHeight: 1.19,
      limit: 2,
    });
  });
  expect(size).toBe(80);
  expect(fitsLineLimit(3 * 140 * 1.19, 140, {lineHeight: 1.19, limit: 2})).toBe(
    false,
  );
});

it('keeps short text at its 120 px limit and shrinks long text', () => {
  expect(
    fitTextInFrame({size: 120, width: 500, height: 200}, () => ({
      width: 10,
      height: 10,
    })),
  ).toBe(120);
  expect(
    fitTextInFrame({size: 120, width: 500, height: 200}, size => ({
      width: size * 10,
      height: size,
    })),
  ).toBeLessThan(120);
});
