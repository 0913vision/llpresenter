import {expect, it} from 'vitest';
import {resolveTextTracking} from '@core/themes/textTracking';

const style = {
  align: 'center',
  tracking: 52,
  shortTracking: {
    maxCharacters: 2,
    tracking: 152,
    overrides: [
      {text: '회개와간구의기도', tracking: 40},
      {text: '봉헌', tracking: 52},
    ],
  },
} as const;

it.each([
  ['회개와간구의기도', 40, 0],
  ['회개와 간구의\n기도', 40, 0],
  ['봉헌', 52, 0],
  ['봉 헌', 52, 0],
  ['찬양', 152, 100],
  ['광고', 152, 100],
  ['축도', 152, 100],
  ['합심기도', 52, 0],
  ['봉헌기도', 52, 0],
  ['', 52, 0],
] as const)(
  'resolves %s without leaking another card override',
  (name, spacing, indent) => {
    expect(resolveTextTracking(style, name)).toEqual({spacing, indent});
  },
);

it('removes only generated continuation markers before matching an override', () => {
  expect(resolveTextTracking(style, '회개와간구의기도 (계속)', true)).toEqual({
    spacing: 40,
    indent: 0,
  });
  expect(resolveTextTracking(style, '회개와간구의기도 (계속)')).toEqual({
    spacing: 52,
    indent: 0,
  });
});

it('keeps legacy short-text spacing when overrides or the option are removed', () => {
  expect(
    resolveTextTracking(
      {...style, shortTracking: {maxCharacters: 2, tracking: 152}},
      '봉헌',
    ),
  ).toEqual({spacing: 152, indent: 100});
  expect(resolveTextTracking({tracking: 12, align: 'center'}, '봉헌')).toEqual({
    spacing: 12,
    indent: 0,
  });
});
