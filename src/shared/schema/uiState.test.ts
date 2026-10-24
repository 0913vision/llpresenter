import {describe, expect, it} from 'vitest';
import {COLUMN_LIMITS, isLayoutChange, parseLayoutChange} from './uiState';

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
