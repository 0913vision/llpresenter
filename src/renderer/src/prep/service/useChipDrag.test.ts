import {describe, expect, it} from 'vitest';
import {dropIndexAt} from './useChipDrag';

const CHIP_HEIGHT = 30;
const ROW_GAP = 8;

function box(left: number, row: number) {
  const top = row * (CHIP_HEIGHT + ROW_GAP);
  return {left, right: left + 50, top, bottom: top + CHIP_HEIGHT};
}

describe('drop position in the 구성 strip', () => {
  it('lands before the first chip whose middle is right of the pointer', () => {
    const row = [box(0, 0), box(58, 0), box(116, 0)];
    expect(dropIndexAt(row, 10, 15)).toBe(0);
    expect(dropIndexAt(row, 30, 15)).toBe(1);
    expect(dropIndexAt(row, 140, 15)).toBe(2);
    expect(dropIndexAt(row, 400, 15)).toBe(3);
  });

  it('uses the row nearest the pointer when the strip wraps', () => {
    const rows = [box(0, 0), box(58, 0), box(0, 1)];
    expect(dropIndexAt(rows, 400, 15)).toBe(2);
    expect(dropIndexAt(rows, 10, 50)).toBe(2);
    expect(dropIndexAt(rows, 400, 50)).toBe(3);
    expect(dropIndexAt(rows, 400, 200)).toBe(3);
  });

  it('lands at the start of an empty strip', () => {
    expect(dropIndexAt([], 10, 10)).toBe(0);
  });
});
