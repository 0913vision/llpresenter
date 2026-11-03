import {defineSlice} from '../../../../../src/main/live/slice';
import {FIXTURE_LOADED_SCREEN} from '../../../core/screenIds';

export const probeSlice = defineSlice({
  commands: ['output.set'],
  initial: {outputs: {[FIXTURE_LOADED_SCREEN]: true}},
  reduce: (history, command, {now}) => ({
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
