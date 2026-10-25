import {defineSlice} from '../slice';

export const screenSettingsSlice = defineSlice({
  commands: ['screen.settings.apply'],
  initial: {},
  reduce: (history, {screenId}, {screenSettings, defer}) => {
    if (screenSettings === undefined) {
      throw new Error('Output settings are not ready');
    }
    screenSettings.requireSaved(screenId);
    defer(() => {
      screenSettings.queueRefresh();
    });
    return history;
  },
});
