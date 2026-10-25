import {describe, expect, it} from 'vitest';
import {
  clampThumbnailScale,
  commitThumbnailScale,
  DEFAULT_THUMBNAIL_SCALE_PERCENT,
  thumbnailWidth,
} from './thumbnailSize';

describe('thumbnail scale', () => {
  it('keeps fractional previews and rounds only committed percentages', () => {
    expect(clampThumbnailScale(123.45)).toBe(123.45);
    expect(commitThumbnailScale(123.45)).toBe(123);
    expect(commitThumbnailScale(123.6)).toBe(124);
  });

  it('clamps the spec-13 range and uses the default for non-finite values', () => {
    expect(clampThumbnailScale(0)).toBe(50);
    expect(clampThumbnailScale(500)).toBe(200);
    expect(clampThumbnailScale(NaN)).toBe(DEFAULT_THUMBNAIL_SCALE_PERCENT);
    expect(clampThumbnailScale(Infinity)).toBe(100);
  });
});

describe('thumbnailWidth', () => {
  const geometry = {gridWidth: 1000, columns: 4, gap: 12};

  it('fits the baseline column count including its gaps at 100%', () => {
    const width = thumbnailWidth({...geometry, scalePercent: 100});
    expect(width).toBe(241);
    expect(width * 4 + 12 * 3).toBe(1000);
  });

  it('scales continuously through the point where a row must wrap', () => {
    const before = thumbnailWidth({...geometry, scalePercent: 99.99});
    const after = thumbnailWidth({...geometry, scalePercent: 100.01});
    expect(before * 4 + 12 * 3).toBeLessThan(1000);
    expect(after * 4 + 12 * 3).toBeGreaterThan(1000);
    expect(after - before).toBeCloseTo(0.0482);
    expect(thumbnailWidth({...geometry, scalePercent: 150})).toBe(361.5);
  });

  it('caps a tile at the available width and tolerates an unmeasured grid', () => {
    expect(thumbnailWidth({...geometry, columns: 1, scalePercent: 200})).toBe(
      1000,
    );
    expect(thumbnailWidth({...geometry, gridWidth: 0, scalePercent: 100})).toBe(
      0,
    );
    expect(
      thumbnailWidth({...geometry, gridWidth: NaN, scalePercent: 100}),
    ).toBe(0);
    expect(
      thumbnailWidth({...geometry, columns: 0, gap: -1, scalePercent: 100}),
    ).toBe(1000);
  });
});
