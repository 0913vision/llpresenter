import type {UndoEntry} from '../history';
import {defineSlice} from '../slice';

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
      if (command.type === 'layer.clear' && next.undo !== null) {
        undo ??= next.undo;
        current = {...next, undo};
      } else {
        current = next;
        if (next.undo === null) undo = null;
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
