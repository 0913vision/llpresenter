import {expect, it} from 'vitest';
import {retainedBibleSelection} from '@core/bible/selection';
import type {SlideTile} from '@core/presentation/model';

const tile = (label: string): SlideTile => ({
  label,
  labelColor: 'none',
  lines: ['가 나'],
});

it('retains the verse part after prepending slides and clamps a reduced part count', () => {
  const previous = [tile('3:16'), tile('3:16'), tile('3:17')];
  const next = [tile('3:15'), tile('3:15'), ...previous];
  expect(retainedBibleSelection(previous, 1, next)).toBe(3);
  expect(
    retainedBibleSelection(previous, 1, [tile('3:16'), tile('3:17')]),
  ).toBe(0);
  expect(retainedBibleSelection(previous, 2, [])).toBe(0);
});
