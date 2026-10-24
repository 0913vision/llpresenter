import {describe, expect, it, vi} from 'vitest';
import {MIN_FONT_SHARE, fitFontSize} from './fitText';

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

  it('stops at the smallest size when nothing fits', () => {
    expect(fitFontSize(84, () => false)).toBe(84 * MIN_FONT_SHARE);
  });

  it('tries only a few sizes', () => {
    const fits = vi.fn((size: number) => size <= 50);
    fitFontSize(84, fits);
    expect(fits.mock.calls.length).toBeLessThanOrEqual(8);
  });
});
