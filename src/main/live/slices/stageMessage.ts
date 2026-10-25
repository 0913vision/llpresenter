import {defineSlice} from '../slice';

export const stageMessageSlice = defineSlice({
  commands: ['stage.message.set'],
  initial: {},
  reduce: (history, {text}) => {
    if ((history.state.stageMessage ?? null) === text) return history;
    return {
      ...history,
      state: {
        ...history.state,
        stageMessage: text,
        version: history.state.version + 1,
      },
    };
  },
});
