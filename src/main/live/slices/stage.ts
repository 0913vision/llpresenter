import {MissingLiveTargetError} from '../commandErrors';
import type {LiveHistory} from '../history';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function setTimer(
  history: LiveHistory,
  {timerId}: CommandOf<'stage.timer.set'>,
  {settings}: SliceContext,
): LiveHistory {
  const {state} = history;
  if ((state.stageTimerId ?? null) === timerId) return history;
  if (timerId !== null) {
    const timers = settings?.get('timers');
    if (timers?.name !== 'timers') {
      throw new Error('Timer settings are unavailable');
    }
    if (!timers.value.timers.some(({id}) => id === timerId)) {
      throw new MissingLiveTargetError({kind: 'timer', id: timerId});
    }
  }
  const {stageTimerId: _previous, ...rest} = state;
  return {
    ...history,
    state: {
      ...rest,
      ...(timerId === null ? {} : {stageTimerId: timerId}),
      version: state.version + 1,
    },
  };
}

/** The 타이머 that the 무대 화면's 타이머 element shows. */
export const stageSlice = defineSlice({
  commands: ['stage.timer.set'],
  initial: {},
  reduce: setTimer,
});
