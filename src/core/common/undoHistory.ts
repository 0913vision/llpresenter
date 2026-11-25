/**
 * How many steps one 실행 취소 history keeps, in main and in a window alike:
 * the oldest is forgotten when a new step would pass it, so a long service
 * never piles up the documents its deletions keep.
 */
export const UNDO_HISTORY_LIMIT = 100;

/** Adds a step to an undo list, forgetting the oldest past the limit. */
export function pushUndoStep<TStep>(steps: TStep[], step: TStep): void {
  steps.push(step);
  if (steps.length > UNDO_HISTORY_LIMIT) {
    steps.splice(0, steps.length - UNDO_HISTORY_LIMIT);
  }
}
