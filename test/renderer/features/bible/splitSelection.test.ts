import {expect, it} from 'vitest';
import {retainedBibleSelection} from '@core/bible/selection';
import type {SlideTile} from '@core/presentation/model';
import {VERSE_SLIDE, VERSE_REPEAT} from '@fixtures/core/slidesBible';

const tile = (label: string): SlideTile => ({
  label,
  labelColor: 'none',
  lines: ['가 나'],
});

it('distinguishes repeated verse slots and retains their continuation after earlier cuts change', () => {
  const a = {...tile('3:16'), sourceSlideId: VERSE_SLIDE, biblePart: 1};
  const b = {...a, sourceSlideId: VERSE_REPEAT};
  const previous = [a, b, {...b, biblePart: 2}];
  const next = [a, {...a, biblePart: 2}, b, {...b, biblePart: 2}];
  expect(retainedBibleSelection(previous, 2, next)).toBe(3);
  expect(retainedBibleSelection(previous, 2, next.slice(0, -1))).toBe(2);
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
