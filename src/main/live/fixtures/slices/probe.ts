import {defineSlice} from '../../slice';

export const probeSlice = defineSlice({
  commands: ['output.set'],
  initial: {outputs: {'fixture-loaded': true}},
  reduce: (history, command, now) => ({
    ...history,
    state: {
      ...history.state,
      version: history.state.version + 1,
      outputs: {...history.state.outputs, [command.screenId]: command.on},
      layers: {
        ...history.state.layers,
        message: {messageId: 'fixture-reduced', text: String(now)},
      },
    },
  }),
});
