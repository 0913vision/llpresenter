import {defineSlice} from '../slice';

/** Turns each screen's output on and off. */
export const outputsSlice = defineSlice({
  commands: ['output.set'],
  initial: {outputs: {}},
  reduce: (history, {screenId, on}) => {
    const state = history.state;
    if ((state.outputs[screenId] ?? false) === on) return history;
    const outputs = {...state.outputs, [screenId]: on};
    return {...history, state: {...state, version: state.version + 1, outputs}};
  },
});
