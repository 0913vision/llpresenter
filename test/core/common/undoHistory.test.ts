import {expect, it} from 'vitest';
import {pushUndoStep, UNDO_HISTORY_LIMIT} from '@core/common/undoHistory';

it('keeps the latest steps up to the limit and forgets the oldest', () => {
  const steps: number[] = [];
  for (let step = 1; step <= UNDO_HISTORY_LIMIT + 5; step++) {
    pushUndoStep(steps, step);
  }
  expect(steps).toHaveLength(UNDO_HISTORY_LIMIT);
  expect(steps[0]).toBe(6);
  expect(steps.at(-1)).toBe(UNDO_HISTORY_LIMIT + 5);
});
