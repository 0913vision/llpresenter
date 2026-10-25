import {describe, expect, it} from 'vitest';
import {withLayoutChange} from './layout';

const normal = {sizeClass: 'normal'} as const;

describe('withLayoutChange', () => {
  it('starts a layout, and a size class, from nothing', () => {
    expect(
      withLayoutChange(undefined, {...normal, left: 300, right: 500}),
    ).toEqual({normal: {left: 300, right: 500}});
  });

  it('sets the widths and keeps the thumbnail columns and unknown fields', () => {
    const layout = {normal: {left: 240, right: 400, columns: 5, extra: 1}};
    expect(
      withLayoutChange(layout, {...normal, left: 300, right: 500}),
    ).toEqual({normal: {left: 300, right: 500, columns: 5, extra: 1}});
  });

  it('sets the thumbnail columns alone and keeps the widths', () => {
    const layout = {normal: {left: 240, right: 400}};
    expect(withLayoutChange(layout, {...normal, columns: 6})).toEqual({
      normal: {left: 240, right: 400, columns: 6},
    });
  });

  it('writes no undefined for a field the change does not carry', () => {
    const merged = withLayoutChange(undefined, {...normal, columns: 4});
    expect(Object.keys(merged.normal ?? {})).toEqual(['columns']);
  });

  it('keeps the other size classes and does not change its input', () => {
    const layout = {wide: {left: 320, right: 560}};
    const merged = withLayoutChange(layout, {...normal, columns: 3});
    expect(merged).toEqual({
      wide: {left: 320, right: 560},
      normal: {columns: 3},
    });
    expect(layout).toEqual({wide: {left: 320, right: 560}});
  });
});
