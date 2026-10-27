import {describe, expect, it} from 'vitest';
import {editFrame, resizeHandles} from './frameEdit';

const frame = {x: 10, y: 20, w: 100, h: 80};
describe('stage geometry', () => {
  it.each(resizeHandles)(
    'resizes %s while preserving the opposite edges',
    handle => {
      const next = editFrame(frame, {x: 15, y: 25}, handle);
      expect(next.x).toBe(handle.includes('w') ? 25 : 10);
      expect(next.y).toBe(handle.includes('n') ? 45 : 20);
      expect(next.w).toBe(
        handle.includes('w') ? 85 : handle.includes('e') ? 115 : 100,
      );
      expect(next.h).toBe(
        handle.includes('n') ? 55 : handle.includes('s') ? 105 : 80,
      );
    },
  );
  it('moves in whole reference pixels including negative positions', () => {
    expect(editFrame(frame, {x: -30.2, y: 10.1}, 'move')).toEqual({
      ...frame,
      x: -20,
      y: 30,
    });
  });
  it('prevents flipping and rejects nonfinite input', () => {
    expect(editFrame(frame, {x: 1000, y: 1000}, 'nw')).toEqual({
      x: 109,
      y: 99,
      w: 1,
      h: 1,
    });
    expect(editFrame(frame, {x: -1000, y: -1000}, 'se')).toEqual({
      ...frame,
      w: 1,
      h: 1,
    });
    expect(editFrame(frame, {x: Infinity, y: 0}, 'move')).toBe(frame);
  });
});
