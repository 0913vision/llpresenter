import {describe, expect, it, vi} from 'vitest';
import {fitFontSize} from './fitText';

describe('fitFontSize', () => {
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
