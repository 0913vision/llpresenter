import {expect, it} from 'vitest';
import {mediaGridLayout} from '@renderer/features/media/mediaGridLayout';

const bin = {
  columns: 5,
  fitHeight: true,
  width: 2504,
  height: 234,
  xGap: 12,
  yGap: 16,
  nameGap: 8,
  inset: 14,
};

it.each([
  {width: 650, height: 180},
  {width: 1400, height: 234},
  {width: 2504, height: 234},
  {width: 2504, height: 150},
])(
  'fits the picture, name and padding in a $width by $height bin',
  dimensions => {
    const measured = {...bin, ...dimensions};
    const layout = mediaGridLayout(measured);
    expect(
      layout.stride - measured.yGap + measured.inset * 2,
    ).toBeLessThanOrEqual(measured.height);
    expect(layout.columns).toBeGreaterThanOrEqual(measured.columns);
  },
);

it('adds columns on ultrawide and restores the preferred count when room returns', () => {
  expect(mediaGridLayout(bin).columns).toBe(8);
  expect(mediaGridLayout({...bin, height: 500}).columns).toBe(5);
  expect(mediaGridLayout({...bin, width: 650}).columns).toBe(5);
});

it('honors explicit operator sizing and keeps an unmeasured grid bounded', () => {
  expect(mediaGridLayout({...bin, fitHeight: false, columns: 2}).columns).toBe(
    2,
  );
  expect(mediaGridLayout({...bin, width: 0, height: 0})).toEqual({
    columns: 5,
    stride: 1,
  });
  expect(mediaGridLayout({...bin, height: 0}).columns).toBe(5);
});
