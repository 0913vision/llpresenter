import {describe, expect, it} from 'vitest';
import {
  powerpointPictureFilters,
  type PowerPointPictureFilter,
} from '@core/songs/powerpointPictureFilters';

function filteredPixel(
  pixel: number,
  filters: readonly PowerPointPictureFilter[],
): number {
  const output = filters.reduce((channel, filter) => {
    let value = channel;
    switch (filter.kind) {
      case 'brightness':
        value *= filter.amount;
        break;
      case 'contrast':
        value = (value - 0.5) * filter.amount + 0.5;
        break;
      case 'invert':
        value = (1 - value) * filter.amount + value * (1 - filter.amount);
        break;
      case 'grayscale':
        break;
    }
    return Math.max(0, Math.min(1, value));
  }, pixel / 255);
  return output * 255;
}

describe('PowerPoint luminance filters', () => {
  it.each([
    {brightness: 1, expected: [255, 255, 255]},
    {brightness: 0.5, expected: [127.5, 191.5, 255]},
    {brightness: 0, expected: [0, 128, 255]},
    {brightness: -0.5, expected: [0, 64, 127.5]},
    {brightness: -1, expected: [0, 0, 0]},
  ])(
    'moves black, gray and white toward the correct endpoint at $brightness',
    ({brightness, expected}) => {
      const filters = powerpointPictureFilters({
        brightness,
        contrast: 0,
        grayscale: false,
      });
      [0, 128, 255].forEach((pixel, index) => {
        expect(filteredPixel(pixel, filters)).toBeCloseTo(
          expected[index] ?? 0,
          6,
        );
      });
    },
  );

  it('scales contrast around gray while preserving the grayscale luminance step', () => {
    const filters = powerpointPictureFilters({
      brightness: 0,
      contrast: -1,
      grayscale: true,
    });
    expect(filters[0]).toEqual({kind: 'grayscale', amount: 1});
    expect([0, 128, 255].map(pixel => filteredPixel(pixel, filters))).toEqual([
      127.5, 127.5, 127.5,
    ]);
    const positive = powerpointPictureFilters({
      brightness: 0,
      contrast: 1,
      grayscale: false,
    });
    expect(
      [0, 32, 223, 255].map(pixel => filteredPixel(pixel, positive)),
    ).toEqual([0, 0, 255, 255]);
  });

  it('omits identity filters to preserve the normal image sampling path', () => {
    expect(
      powerpointPictureFilters({brightness: 0, contrast: 0, grayscale: false}),
    ).toEqual([]);
  });
});
