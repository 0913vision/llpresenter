import {describe, expect, it} from 'vitest';
import {createSongSlideId} from '@core/schema/ids';
import type {SongSlide} from '@core/schema/song';
import {
  duplicateSlides,
  insertSlides,
  mergeSlideWithPrevious,
  moveSlides,
  pasteSlides,
  removeSlides,
  setSlideLabels,
  splitSlide,
} from '@core/songs/slideEdits';

const id = (n: number) =>
  createSongSlideId(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const slide = (n: number): SongSlide => ({
  id: id(n),
  lines: [`Line ${n}`],
  label: '후렴',
});
function value(result: ReturnType<typeof moveSlides>) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('independent slide edits', () => {
  it('moves a noncontiguous selection in deck order to an original gap', () => {
    const source = [1, 2, 3, 4, 5].map(slide);
    expect(value(moveSlides(source, [id(4), id(2)], 5)).map(s => s.id)).toEqual(
      [1, 3, 5, 2, 4].map(id),
    );
    expect(source.map(s => s.id)).toEqual([1, 2, 3, 4, 5].map(id));
  });
  it('removes all item slides and refuses insertions with duplicate identities', () => {
    expect(value(removeSlides([slide(1)], [id(1)]))).toEqual([]);
    expect(insertSlides([slide(1)], [slide(1)], 0).ok).toBe(false);
    expect(moveSlides([slide(1)], [], -1).ok).toBe(false);
  });
  it('duplicates after the last selection with fresh identities and no conflicting keys', () => {
    let next = 10;
    const source = [{...slide(1), hotKey: 'KeyA'}, slide(2), slide(3)];
    const copy = value(
      duplicateSlides(source, [id(1), id(3)], () => id(next++)),
    );
    expect(copy.map(s => s.id)).toEqual([1, 2, 3, 10, 11].map(id));
    expect(copy[3]).toEqual({...slide(1), id: id(10)});
    expect(copy[3]?.lines).not.toBe(source[0]?.lines);
  });
  it('retains a pasted key only when it is free in the destination', () => {
    const copied = {...slide(2), hotKey: 'KeyA'};
    expect(
      value(pasteSlides([], [copied], {index: 0, newId: () => id(9)}))[0],
    ).toEqual({...copied, id: id(9)});
    expect(
      value(
        pasteSlides([{...slide(1), hotKey: 'KeyA'}], [copied], {
          index: 1,
          newId: () => id(9),
        }),
      )[1]?.hotKey,
    ).toBeUndefined();
  });
  it('splits at a character and merges across labels without sharing identity', () => {
    const original = {...slide(1), lines: ['first', 'second'], hotKey: 'KeyA'};
    const split = value(
      splitSlide([original], id(1), {
        line: 1,
        character: 3,
        newId: () => id(2),
      }),
    );
    expect(split).toEqual([
      {...original, lines: ['first', 'sec']},
      {...slide(2), lines: ['ond']},
    ]);
    const merged = value(
      mergeSlideWithPrevious(
        [
          split[0] ?? original,
          {...slide(2), label: '자유 이름', lines: ['ond']},
        ],
        id(2),
      ),
    );
    expect(merged).toEqual([{...original, lines: ['first', 'sec', 'ond']}]);
  });
  it('sets a free name on only the selected slides and validates its length', () => {
    const source = [slide(1), slide(2)];
    expect(value(setSlideLabels(source, [id(2)], '  오늘  '))[1]?.label).toBe(
      '오늘',
    );
    expect(
      value(setSlideLabels(source, [id(1)], undefined))[0]?.label,
    ).toBeUndefined();
    expect(setSlideLabels(source, [id(1)], 'x'.repeat(65)).ok).toBe(false);
  });
});

it('moves, copies and removes repeated titles without merging or splitting them', () => {
  const title: SongSlide = {
    ...slide(1),
    titleSlide: true,
    titleLayout: {titleTracking: 12, subtitleTracking: 12},
    lines: ['Title', 'Subtitle'],
  };
  const deck = [title, slide(2), {...title, id: id(3)}];
  const copied = value(duplicateSlides(deck, [id(3)], () => id(4)));
  expect(copied[3]).toEqual({...title, id: id(4)});
  const moved = value(moveSlides(copied, [id(1)], 2));
  expect(moved.map(entry => entry.id)).toEqual([id(2), id(1), id(3), id(4)]);
  expect(
    value(pasteSlides(deck, [title], {index: 1, newId: () => id(5)}))[1],
  ).toEqual({...title, id: id(5)});
  expect(value(removeSlides(deck, [id(3)]))).toEqual(deck.slice(0, 2));
  for (const selected of [id(2), id(3)]) {
    expect(mergeSlideWithPrevious(deck, selected).ok).toBe(false);
  }
  expect(splitSlide(deck, id(3), {line: 0, character: 2}).ok).toBe(false);
});
