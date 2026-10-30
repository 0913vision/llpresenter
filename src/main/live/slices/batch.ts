import type {UndoEntry} from '../history';
import type {SingleLiveCommand} from '@core/live/commands';
import {defineSlice} from '../slice';

function groupedUndo(
  previous: UndoEntry | null,
  next: UndoEntry,
  command: Extract<SingleLiveCommand, {type: 'layer.clear' | 'overlay.clear'}>,
): UndoEntry {
  if (previous === null) return next;
  const {clearedMessageIds, ...snapshot} = previous;
  const allMessages =
    command.type === 'layer.clear' &&
    (command.target === 'message' || command.target === 'all');
  const ids = allMessages
    ? []
    : [
        ...new Set([
          ...(clearedMessageIds ?? []),
          ...(next.clearedMessageIds ?? []),
        ]),
      ];
  return {
    ...snapshot,
    ...(ids.length === 0 ? {} : {clearedMessageIds: ids}),
    ...(next.audioClearedAt === undefined
      ? {}
      : {audioClearedAt: next.audioClearedAt}),
    ...(next.stageMessage === undefined
      ? {}
      : {stageMessage: next.stageMessage}),
  };
}

/** Applies an ordered transaction, grouping its clears into one undo entry. */
export const batchSlice = defineSlice({
  commands: ['live.batch'],
  initial: {},
  reduce: (history, {commands}, context) => {
    let current = history;
    let undo: UndoEntry | null = null;
    for (const command of commands) {
      const next = context.apply(current, command);
      if (next === current) continue;
      if (
        (command.type === 'layer.clear' || command.type === 'overlay.clear') &&
        next.undo !== null
      ) {
        undo = groupedUndo(undo, next.undo, command);
        current = {...next, undo};
      } else {
        current = next;
        if (undo !== null) undo = next.undo;
      }
    }
    return current === history
      ? history
      : {
          ...current,
          state: {...current.state, version: history.state.version + 1},
        };
  },
});
