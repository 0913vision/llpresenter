import {expect, it} from 'vitest';
import {moveSelection, orderedSelection} from '@core/common/selectionOrder';

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
