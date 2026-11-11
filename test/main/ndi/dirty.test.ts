import {describe, expect, it} from 'vitest';

import {applyDirty} from '../../../src/main/ndi/dirty.cjs';

describe('NDI dirty regions', () => {
  it('updates only the dirty region and converts premultiplied alpha', () => {
    const frame = Buffer.alloc(4 * 3 * 4, 42);
    applyDirty(
      frame,
      {
        x: 1,
        y: 1,
        width: 2,
        height: 1,
        data: Buffer.from([32, 16, 8, 128, 1, 2, 3, 255]),
      },
      {width: 4, height: 3},
    );
    expect([...frame.subarray(20, 28)]).toEqual([
      64, 32, 16, 128, 1, 2, 3, 255,
    ]);
    expect([...frame.subarray(16, 20)]).toEqual([42, 42, 42, 42]);
    applyDirty(
      frame,
      {x: 1, y: 1, width: 1, height: 1, data: Buffer.from([4, 5, 6, 0])},
      {width: 4, height: 3},
    );
    expect([...frame.subarray(20, 28)]).toEqual([0, 0, 0, 0, 1, 2, 3, 255]);
  });
  it('rejects regions outside the frame or with incomplete data', () => {
    const frame = Buffer.alloc(16);
    expect(() =>
      applyDirty(
        frame,
        {x: 1, y: 0, width: 2, height: 1, data: Buffer.alloc(8)},
        {width: 2, height: 2},
      ),
    ).toThrow();
    expect(() =>
      applyDirty(
        frame,
        {x: 0, y: 0, width: 1, height: 1, data: Buffer.alloc(3)},
        {width: 2, height: 2},
      ),
    ).toThrow();
  });
});
