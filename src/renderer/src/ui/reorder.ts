import {commandBindings} from '@core/shortcuts/bindings';
import {matchesBinding} from '@core/shortcuts/matching';
import {commandBindingStore} from './commandBindings';
import {useCommandShortcuts} from './commandDispatcher';
import {isInTextEntry} from './textEntry';

/**
 * How far a pointer travels before a press on a row becomes a drag to reorder.
 * Every list that reorders by dragging starts at this distance.
 */
export const REORDER_THRESHOLD_PX = 4;

/** Where one row goes for a move by one place. */
export interface RowStep<TId extends string = string> {
  /** The row to put it before; null puts it last. */
  readonly before: TId | null;
}

/**
 * The move that takes a row one place up or down, or undefined when it is
 * already at that end or is not in the list.
 */
export function stepMove<TId extends string>(
  ids: readonly TId[],
  id: TId,
  direction: 'up' | 'down',
): RowStep<TId> | undefined {
  const index = ids.indexOf(id);
  if (index < 0) return undefined;
  if (direction === 'up') {
    const previous = ids[index - 1];
    return previous === undefined ? undefined : {before: previous};
  }
  if (index >= ids.length - 1) return undefined;
  return {before: ids[index + 2] ?? null};
}

interface RowMoveKeys {
  /** Whether the press happened inside this list. */
  readonly owns: (event: KeyboardEvent) => boolean;
  /** The id of the row a press happened on, or null outside a movable row. */
  readonly rowId: (target: EventTarget | null) => string | null;
  /** The ids in the order the list shows them. */
  readonly ids: readonly string[];
  readonly enabled: boolean;
  /** Writes the move; the list keeps its own data write. */
  readonly onMove: (id: string, before: string | null) => void;
}

/**
 * The keyboard alternative of dragging a row: 위로 옮기기 and 아래로 옮기기
 * (Alt ↑ and Alt ↓ by default) move the focused row by one place. A key typed
 * in a field is left to the field.
 */
export function useRowMoveKeys({
  owns,
  rowId,
  ids,
  enabled,
  onMove,
}: RowMoveKeys): void {
  const ownsRow = (event: KeyboardEvent): boolean =>
    enabled &&
    owns(event) &&
    !(event.target instanceof Node && isInTextEntry(event.target)) &&
    rowId(event.target) !== null;
  const step =
    (direction: 'up' | 'down') =>
    (event: KeyboardEvent): void => {
      const id = rowId(event.target);
      if (id === null) return;
      const move = stepMove(ids, id, direction);
      if (move !== undefined) onMove(id, move.before);
      event.preventDefault();
    };
  useCommandShortcuts([
    {id: 'list.moveUp', when: ownsRow, run: step('up')},
    {id: 'list.moveDown', when: ownsRow, run: step('down')},
  ]);
}

/**
 * Which move key a press is, for a list inside a popup, where the window's
 * command dispatcher leaves the keys to the popup. The keys are the ones the
 * operator set for 위로 옮기기 and 아래로 옮기기.
 */
export function rowMoveDirection(
  event: KeyboardEvent,
): 'up' | 'down' | undefined {
  const overrides = commandBindingStore.get();
  const conflicts = commandBindingStore.conflicts();
  const hit = (id: string): boolean =>
    commandBindings(id, overrides).some(
      binding =>
        matchesBinding(event, binding) &&
        !conflicts.some(
          conflict =>
            conflict.second === id && matchesBinding(event, conflict.binding),
        ),
    );
  if (hit('list.moveUp')) return 'up';
  return hit('list.moveDown') ? 'down' : undefined;
}
