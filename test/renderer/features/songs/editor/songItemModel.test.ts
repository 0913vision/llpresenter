import {expect, it} from 'vitest';
import {shownPosition} from '@renderer/features/songs/editor/songItemModel';

it('clamps the selected position and handles an empty deck', () => {
  expect(shownPosition(1, 3)).toBe(1);
  expect(shownPosition(9, 3)).toBe(2);
  expect(shownPosition(5, 0)).toBeUndefined();
});
