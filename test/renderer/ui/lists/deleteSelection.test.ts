import {expect, it, vi} from 'vitest';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';

it.each([1, 3])('deletes %i chosen items at once', count => {
  const remove = vi.fn();
  deleteSelection(count, () => true, remove);
  expect(remove).toHaveBeenCalledOnce();
});

it('ignores an empty choice or one that no longer stands', () => {
  const remove = vi.fn();
  deleteSelection(0, () => true, remove);
  deleteSelection(2, () => false, remove);
  expect(remove).not.toHaveBeenCalled();
});
