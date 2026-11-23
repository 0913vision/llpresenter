import {describe, expect, it} from 'vitest';
import {listKeyTarget, rowRange} from '@renderer/ui/useRowRange';

const options = {initialRows: 4, overscan: 2};

describe('the rows a long list mounts', () => {
  it('mounts the first rows before the list was measured', () => {
    expect(rowRange({top: 0, height: 0, row: 0}, 100, options)).toEqual({
      start: 0,
      end: 8,
    });
  });

  it('mounts the rows on screen and two more on each side', () => {
    expect(rowRange({top: 400, height: 200, row: 40}, 100, options)).toEqual({
      start: 8,
      end: 17,
    });
  });

  it('stays inside a short list and at its end', () => {
    expect(rowRange({top: 0, height: 400, row: 40}, 3, options)).toEqual({
      start: 0,
      end: 3,
    });
    expect(rowRange({top: 3800, height: 200, row: 40}, 100, options)).toEqual({
      start: 93,
      end: 100,
    });
  });
});

describe('the row a list key moves to', () => {
  it('moves one row with the arrows and to the ends with Home and End', () => {
    expect(listKeyTarget('ArrowDown', 3, 10)).toBe(4);
    expect(listKeyTarget('ArrowUp', 3, 10)).toBe(2);
    expect(listKeyTarget('Home', 3, 10)).toBe(0);
    expect(listKeyTarget('End', 3, 10)).toBe(9);
  });

  it('stops at the ends and ignores other keys and empty lists', () => {
    expect(listKeyTarget('ArrowDown', 9, 10)).toBe(9);
    expect(listKeyTarget('ArrowUp', 0, 10)).toBe(0);
    expect(listKeyTarget('ArrowUp', -1, 10)).toBe(0);
    expect(listKeyTarget('Enter', 3, 10)).toBeUndefined();
    expect(listKeyTarget('ArrowDown', 0, 0)).toBeUndefined();
  });
});
