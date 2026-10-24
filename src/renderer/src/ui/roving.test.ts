import {describe, expect, it} from 'vitest';
import {rovingTabStop, rovingTarget} from './roving';

describe('rovingTarget', () => {
  const allOn = [true, true, true];

  it('moves to the neighbours and wraps around the ends', () => {
    expect(rovingTarget(allOn, 0, 'next')).toBe(1);
    expect(rovingTarget(allOn, 2, 'next')).toBe(0);
    expect(rovingTarget(allOn, 0, 'previous')).toBe(2);
  });

  it('goes to the first and the last item', () => {
    expect(rovingTarget(allOn, 1, 'first')).toBe(0);
    expect(rovingTarget(allOn, 1, 'last')).toBe(2);
  });

  it('skips disabled items', () => {
    const middleOff = [true, false, true];
    expect(rovingTarget(middleOff, 0, 'next')).toBe(2);
    expect(rovingTarget(middleOff, 2, 'previous')).toBe(0);
    expect(rovingTarget([false, true, false], 1, 'last')).toBe(1);
  });

  it('finds nothing when every item is disabled', () => {
    expect(rovingTarget([false, false], 0, 'next')).toBeUndefined();
  });
});

describe('rovingTabStop', () => {
  it('puts the Tab stop on the selected item', () => {
    expect(rovingTabStop([true, true], 1)).toBe(1);
  });

  it('falls back to the first enabled item when nothing is selected', () => {
    expect(rovingTabStop([false, true], -1)).toBe(1);
    expect(rovingTabStop([false, false], -1)).toBe(0);
  });
});
