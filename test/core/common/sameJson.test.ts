import {describe, expect, it} from 'vitest';
import {sameJson} from '@core/common/sameJson';

describe('sameJson', () => {
  it('ignores key order and compares nested data', () => {
    expect(sameJson({a: 1, b: [1, {c: 2}]}, {b: [1, {c: 2}], a: 1})).toBe(true);
  });

  it('tells different data apart', () => {
    expect(sameJson({a: 1}, {a: 2})).toBe(false);
    expect(sameJson({a: 1}, {a: 1, b: 1})).toBe(false);
    expect(sameJson([1], [1, 2])).toBe(false);
    expect(sameJson([], {})).toBe(false);
    expect(sameJson(null, {})).toBe(false);
  });
});
