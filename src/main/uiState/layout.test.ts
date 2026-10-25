import {describe, expect, it} from 'vitest';
import {withLayoutChange} from './layout';

const normal = {sizeClass: 'normal'} as const;

describe('withLayoutChange', () => {
  it('starts a layout, and a size class, from nothing', () => {
    expect(
      withLayoutChange(undefined, {...normal, left: 300, right: 500}),
    ).toEqual({normal: {left: 300, right: 500}});
  });

  it('sets the widths and keeps the size, the old columns, and unknown fields', () => {
    const layout = {
      normal: {
        left: 240,
        right: 400,
        thumbnailScalePercent: 120,
        columns: 5,
        extra: 1,
      },
    };
    expect(
      withLayoutChange(layout, {...normal, left: 300, right: 500}),
    ).toEqual({
      normal: {
        left: 300,
        right: 500,
        thumbnailScalePercent: 120,
        columns: 5,
        extra: 1,
      },
    });
  });

  it('sets the 슬라이드 size alone and keeps the widths', () => {
    const layout = {normal: {left: 240, right: 400}};
    expect(
      withLayoutChange(layout, {...normal, thumbnailScalePercent: 150}),
    ).toEqual({normal: {left: 240, right: 400, thumbnailScalePercent: 150}});
  });

  it('writes no undefined for a field the change does not carry', () => {
    const merged = withLayoutChange(undefined, {
      ...normal,
      thumbnailScalePercent: 80,
    });
    expect(Object.keys(merged.normal ?? {})).toEqual(['thumbnailScalePercent']);
  });

  it('keeps the other size classes and does not change its input', () => {
    const layout = {wide: {left: 320, right: 560}};
    const merged = withLayoutChange(layout, {
      ...normal,
      thumbnailScalePercent: 90,
    });
    expect(merged).toEqual({
      wide: {left: 320, right: 560},
      normal: {thumbnailScalePercent: 90},
    });
    expect(layout).toEqual({wide: {left: 320, right: 560}});
  });
});
