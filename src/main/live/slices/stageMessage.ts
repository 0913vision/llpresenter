import {defineSlice} from '../slice';

export const stageMessageSlice = defineSlice({
  commands: ['stage.message.set'],
  initial: {},
  reduce: (history, {text}) => {
    if ((history.state.stageMessage ?? null) === text) return history;
    const endsUndo = history.undo?.stageMessage !== undefined;
    return {
      ...history,
      undo: endsUndo ? null : history.undo,
      state: {
        ...history.state,
        stageMessage: text,
        canUndo: endsUndo ? false : history.state.canUndo,
        version: history.state.version + 1,
      },
    };
  },
});
