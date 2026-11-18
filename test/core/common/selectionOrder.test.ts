import {expect, it} from 'vitest';
import {
  isUnchangedSelectionMove,
  moveSelection,
  orderedSelection,
} from '@core/common/selectionOrder';

it('moves disjoint selections in document order, regardless of selection order', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map(id => ({id}));
  expect(
    moveSelection(rows, new Set(['d', 'b']), 5).map(row => row.id),
  ).toEqual(['a', 'c', 'e', 'b', 'd']);
  expect(
    moveSelection(rows, new Set(['d', 'b']), 0).map(row => row.id),
  ).toEqual(['b', 'd', 'a', 'c', 'e']);
  expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
});
it('includes each selected section and overlapping selected child once', () => {
  const rows = ['header1', 'a', 'b', 'header2', 'c'].map(id => ({id}));
  expect(
    orderedSelection(rows, new Set(['b', 'header1', 'c']), row =>
      row.id.startsWith('header'),
    ).map(row => row.id),
  ).toEqual(['header1', 'a', 'b', 'c']);
});

it('recognizes every gap that leaves the selected rows in place', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const rows = ids.map(id => ({id}));
  for (const chosen of [['b'], ['b', 'c'], ['a', 'c']]) {
    const selected = new Set(chosen);
    for (let gap = 0; gap <= ids.length; gap++) {
      const result = moveSelection(rows, selected, gap).map(row => row.id);
      expect(isUnchangedSelectionMove(ids, selected, gap)).toBe(
        result.every((id, index) => id === ids[index]),
      );
    }
  }
  expect(isUnchangedSelectionMove(ids, new Set(['b']), 1)).toBe(true);
  expect(isUnchangedSelectionMove(ids, new Set(['b']), 2)).toBe(true);
  expect(isUnchangedSelectionMove(ids, new Set(['b']), 3)).toBe(false);
});
