import {MissingLiveTargetError} from '../commandErrors';
import {defineSlice} from '../slice';

export const lookSlice = defineSlice({
  commands: ['look.set'],
  initial: {},
  reduce: (history, {lookId}, {settings}) => {
    const document = settings?.get('looks');
    if (document?.name !== 'looks') {
      throw new Error('Look settings are unavailable');
    }
    if (!document.value.looks.some(look => look.id === lookId)) {
      throw new MissingLiveTargetError({kind: 'look', id: lookId});
    }
    if ((history.state.lookId ?? document.value.current) === lookId) {
      return history;
    }
    return {
      ...history,
      state: {...history.state, lookId, version: history.state.version + 1},
    };
  },
});
