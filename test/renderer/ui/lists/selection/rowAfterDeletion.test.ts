import {expect, it} from 'vitest';
import {rowAfterDeletion} from '@renderer/ui/lists/selection/rowAfterDeletion';

function rows(...ids: string[]) {
  return ids.map(id => ({id}));
}

it('goes to the first row left after the deleted ones, or else the last one before them', () => {
  const before = rows('a', 'b', 'c', 'd');
  expect(rowAfterDeletion(before, ['b', 'c'], rows('a', 'd'))).toBe('d');
  expect(rowAfterDeletion(before, ['c', 'd'], rows('a', 'b'))).toBe('b');
  expect(rowAfterDeletion(before, ['a', 'b', 'c', 'd'], [])).toBeUndefined();
  expect(rowAfterDeletion(before, ['x'], before)).toBeUndefined();
});
