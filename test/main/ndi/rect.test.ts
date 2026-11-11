import {describe, expect, it} from 'vitest';
import {unionDirty} from '../../../src/main/ndi/rect';

describe('unionDirty', () => {
  it('covers separate and overlapping pending updates', () => {
    const left = {x: 10, y: 10, width: 20, height: 10};
    const right = {x: 50, y: 5, width: 10, height: 30};
    expect(unionDirty(left, right)).toEqual({
      x: 10,
      y: 5,
      width: 50,
      height: 30,
    });
    expect(unionDirty(right, left)).toEqual(unionDirty(left, right));
    expect(unionDirty(left, {x: 12, y: 12, width: 3, height: 3})).toEqual(left);
  });
});
