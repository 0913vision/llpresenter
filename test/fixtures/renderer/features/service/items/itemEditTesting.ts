import {onTestFinished, vi} from 'vitest';
import {
  ItemEditQueue,
  type ItemProblem,
} from '@renderer/features/service/items/itemEditQueue';
import {itemFixture} from '@fixtures/renderer/features/service/items/itemFixture';
/** The existing service mocks with one item queue shared by command and memo tests. */
export function itemEditFixture() {
  const fixture = itemFixture();
  const problem = vi.fn<ItemProblem>();
  const queue = new ItemEditQueue(fixture.api, problem);
  onTestFinished(() => {
    queue.dispose();
  });
  return {...fixture, queue, problem};
}
