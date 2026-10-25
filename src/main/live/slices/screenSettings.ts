import {defineSlice} from '../slice';

export const screenSettingsSlice = defineSlice({
  commands: ['screen.settings.apply'],
  initial: {},
  reduce: (history, {screenId}, {resyncScreen}) => {
    if (resyncScreen === undefined) {
      throw new Error('Output settings are not ready');
    }
    // NOTE(0913vision): LiveStore supplies this deferred, idempotent resync.
    // It validates the saved ID now and queues refresh after reduction;
    // applyCommand has no callback and never schedules window work.
    resyncScreen(screenId);
    return history;
  },
});
