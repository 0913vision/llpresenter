import {describe, expect, it} from 'vitest';
import {reconcileSlideRowMeasurements} from '@renderer/ui/slideRowMeasurements';

describe('slide row measurement cache', () => {
  it('prunes removed slides and preserves current slide heights', () => {
    const original = {
      scope: 'grid:100',
      ids: new Set(['a', 'b', 'leading-card']),
      values: {a: 120, b: 180, 'leading-card': 200},
    };
    const pruned = reconcileSlideRowMeasurements(original, 'grid:100', [
      'a',
      'leading-card',
    ]);
    expect(pruned.values).toEqual({a: 120, 'leading-card': 200});
    expect(
      reconcileSlideRowMeasurements(pruned, 'grid:100', ['leading-card', 'a']),
    ).toBe(pruned);
  });
  it('drops old measurements when zoom or view changes', () => {
    const original = {scope: 'grid:100', ids: new Set(['a']), values: {a: 120}};
    expect(
      reconcileSlideRowMeasurements(original, 'grid:125', ['a']).values,
    ).toEqual({});
    expect(
      reconcileSlideRowMeasurements(original, 'list:100', ['a']).values,
    ).toEqual({});
  });
});
