import {expect, it} from 'vitest';
import {biblePartIndex, retainedBibleSelection} from '@core/bible/selection';
import type {SlideTile} from '@core/presentation/model';
import {createThemeId} from '@core/schema/ids';
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

it('keeps verse selection when part numbers appear or disappear', () => {
  const previous = [tile('\uC6943:16'), tile('\uC6943:17')];
  const split = [
    {...tile('\uC6943:16 (1)'), biblePart: 1},
    {...tile('\uC6943:16 (2)'), biblePart: 2},
    {...tile('\uC6943:17 (1)'), biblePart: 1},
    {...tile('\uC6943:17 (2)'), biblePart: 2},
  ];
  expect(retainedBibleSelection(previous, 1, split)).toBe(2);
  expect(retainedBibleSelection(split, 3, previous)).toBe(1);
});

it('keeps a reference-named section card separate from verse parts', () => {
  const card = {
    ...tile('\uC694\uD55C\uBCF5\uC74C 3:16'),
    sectionCard: {
      name: 'Sample',
      english: 'Sample',
      theme: createThemeId('00000000-0000-4000-8000-000000000111'),
    },
  };
  const previous = [card, tile('\uC6943:16')];
  const next = [
    card,
    {...tile('\uC6943:16 (1)'), biblePart: 1},
    {...tile('\uC6943:16 (2)'), biblePart: 2},
  ];
  expect(retainedBibleSelection(previous, 0, next)).toBe(0);
  expect(retainedBibleSelection(previous, 1, next)).toBe(1);
  expect(retainedBibleSelection(next, 2, previous)).toBe(1);
  expect(biblePartIndex(next, {label: '\uC6943:16 (1)', part: 1})).toBe(1);
  expect(biblePartIndex(next, {label: '\uC6943:16 (2)', part: 2})).toBe(2);
});
