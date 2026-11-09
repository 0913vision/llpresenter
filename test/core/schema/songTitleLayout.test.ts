import {expect, it} from 'vitest';
import {checkPart} from '@core/schema/fileFormat';
import {songTitleLayoutSchema} from '@core/schema/songTitleLayout';

it('accepts measured spacing and finite canvas limits', () => {
  for (const spacing of [
    {titleTracking: 12, subtitleTracking: 12},
    {titleTracking: 0, subtitleTracking: 24},
    {titleTracking: -20, subtitleTracking: 200},
  ]) {
    expect(checkPart(songTitleLayoutSchema, spacing)).toEqual({
      ok: true,
      value: spacing,
    });
  }
});

it('rejects missing, nonnumeric and out-of-range spacing', () => {
  for (const value of [undefined, null, '12', NaN, Infinity, -20.1, 200.1]) {
    expect(
      checkPart(songTitleLayoutSchema, {
        titleTracking: value,
        subtitleTracking: 12,
      }).ok,
    ).toBe(false);
    expect(
      checkPart(songTitleLayoutSchema, {
        titleTracking: 12,
        subtitleTracking: value,
      }).ok,
    ).toBe(false);
  }
});

it('bounds optional title positions to the canvas while retaining omitted defaults', () => {
  const spacing = {titleTracking: 0, subtitleTracking: 24};
  for (const [field, max] of [
    ['titleTop', 920],
    ['subtitleTop', 990],
  ] as const) {
    for (const value of [0, max, 338.5]) {
      expect(
        checkPart(songTitleLayoutSchema, {...spacing, [field]: value}).ok,
      ).toBe(true);
    }
    for (const value of [-1, max + 1, NaN, Infinity, '338', null]) {
      expect(
        checkPart(songTitleLayoutSchema, {...spacing, [field]: value}).ok,
      ).toBe(false);
    }
  }
});
