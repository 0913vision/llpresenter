import {describe, expect, expectTypeOf, it} from 'vitest';
import {
  COLUMN_LIMITS,
  isLayoutChange,
  parseLayoutChange,
  parseUiState,
  type LayoutChange,
} from './uiState';

describe('parseLayoutChange', () => {
  it('accepts every size class at both ends of the ranges', () => {
    for (const sizeClass of ['narrow', 'normal', 'wide']) {
      for (const [left, right] of [
        [COLUMN_LIMITS.left.min, COLUMN_LIMITS.right.min],
        [COLUMN_LIMITS.left.max, COLUMN_LIMITS.right.max],
      ]) {
        expect(parseLayoutChange({sizeClass, left, right})).toEqual({
          ok: true,
          value: {sizeClass, left, right},
        });
      }
    }
  });

  it('drops fields it does not know', () => {
    expect(
      parseLayoutChange({sizeClass: 'wide', left: 300, right: 500, x: 1}),
    ).toEqual({ok: true, value: {sizeClass: 'wide', left: 300, right: 500}});
  });

  it.each([
    ['a left width under the range', {left: 199}, 'left'],
    ['a left width over the range', {left: 401}, 'left'],
    ['a right width under the range', {right: 319}, 'right'],
    ['a right width over the range', {right: 721}, 'right'],
    ['a fractional width', {left: 250.5}, 'left'],
    ['an unknown size class', {sizeClass: 'compact'}, 'sizeClass'],
    ['a width that is text', {right: '480'}, 'right'],
  ])('rejects %s', (_name, change, field) => {
    const result = parseLayoutChange({
      sizeClass: 'normal',
      left: 280,
      right: 480,
      ...change,
    });

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });

  it('rejects values that are not objects', () => {
    for (const value of [null, undefined, 'normal', [], 3]) {
      expect(isLayoutChange(value)).toBe(false);
    }
  });
});

describe('parseLayoutChange with thumbnail scale', () => {
  it.each([
    ['nothing to change', {sizeClass: 'wide'}, ''],
    ['a left width without a right one', {sizeClass: 'wide', left: 300}, ''],
    ['a right width without a left one', {sizeClass: 'wide', right: 500}, ''],
    ['legacy columns alone', {sizeClass: 'wide', columns: 3}, ''],
  ])('rejects %s', (_name, change, field) => {
    const result = parseLayoutChange(change);

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });
  it('accepts whole percentages in every size class, alone or with widths', () => {
    for (const sizeClass of ['narrow', 'normal', 'wide']) {
      for (const thumbnailScalePercent of [50, 100, 123, 200]) {
        for (const fields of [{}, {left: 280, right: 480}]) {
          const change = {sizeClass, thumbnailScalePercent, ...fields};
          expect(parseLayoutChange(change)).toEqual({ok: true, value: change});
        }
      }
    }
  });

  it.each([49, 201, 100.5, 0, -1, '100', null, NaN, Infinity])(
    'rejects invalid scale %j even alongside valid widths',
    thumbnailScalePercent => {
      const result = parseLayoutChange({
        sizeClass: 'normal',
        left: 280,
        right: 480,
        thumbnailScalePercent,
      });
      expect(result.ok ? undefined : result.error.field).toBe(
        'thumbnailScalePercent',
      );
    },
  );

  it('still requires paired widths when a scale is present', () => {
    for (const widths of [{left: 280}, {right: 480}]) {
      expect(
        isLayoutChange({
          sizeClass: 'normal',
          thumbnailScalePercent: 100,
          ...widths,
        }),
      ).toBe(false);
    }
  });

  it('drops legacy columns alongside a valid scale, widths, or both', () => {
    for (const fields of [
      {thumbnailScalePercent: 123},
      {left: 280, right: 480},
      {left: 280, right: 480, thumbnailScalePercent: 123},
    ]) {
      const change = {sizeClass: 'normal', ...fields};
      expect(parseLayoutChange({...change, columns: 3})).toEqual({
        ok: true,
        value: change,
      });
    }
  });

  it('exposes only widths and scale in the command type', () => {
    expectTypeOf<keyof LayoutChange>().toEqualTypeOf<
      'sizeClass' | 'left' | 'right' | 'thumbnailScalePercent'
    >();
  });
});

describe('parseUiState', () => {
  it('accepts an empty state and a saved layout', () => {
    const state = {
      layout: {normal: {left: 280, right: 480}, wide: {columns: 6}},
    };

    expect(parseUiState({})).toEqual({ok: true, value: {}});
    expect(parseUiState(state)).toEqual({ok: true, value: state});
  });

  it('preserves new and legacy fields, including positive values for the shell to clamp', () => {
    const state = {
      layout: {
        narrow: {columns: 3, thumbnailScalePercent: 1},
        normal: {left: 280, right: 480, thumbnailScalePercent: 123},
        wide: {columns: 6, thumbnailScalePercent: 999, future: true},
      },
    };
    expect(parseUiState(state)).toEqual({ok: true, value: state});
  });

  it.each([
    [
      'a width that is text',
      {layout: {normal: {left: 'bad'}}},
      'layout.normal.left',
    ],
    ['a layout that is an array', {layout: []}, 'layout'],
    ['a state that is an array', [], ''],
    ['a size class that is an array', {layout: {wide: []}}, 'layout.wide'],
    [
      'a fractional scale',
      {layout: {normal: {thumbnailScalePercent: 100.5}}},
      'layout.normal.thumbnailScalePercent',
    ],
    [
      'zero scale',
      {layout: {normal: {thumbnailScalePercent: 0}}},
      'layout.normal.thumbnailScalePercent',
    ],
  ])('rejects %s', (_name, value, field) => {
    const result = parseUiState(value);

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });

  it('rejects values that are not objects', () => {
    for (const value of [null, undefined, 'state', 3]) {
      expect(parseUiState(value).ok).toBe(false);
    }
  });
});
