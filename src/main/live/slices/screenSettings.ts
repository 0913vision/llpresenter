import {defineSlice} from '../slice';

export const screenSettingsSlice = defineSlice({
  commands: ['screen.settings.apply'],
  initial: {},
  reduce: (history, {screenId}, {resyncScreen}) => {
    if (resyncScreen === undefined) {
      throw new Error('Output settings are not ready');
    }
    resyncScreen(screenId);
    return history;
  },
});
