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
    // NOTE(0913vision): A Look change ends the stage layouts chosen for this
    // output, so each stage screen takes the new Look's layout (spec 03).
    const {stageLayouts: _chosen, ...state} = history.state;
    return {
      ...history,
      state: {...state, lookId, version: state.version + 1},
    };
  },
});
