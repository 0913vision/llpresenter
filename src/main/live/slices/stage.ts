import type {StageLayoutId} from '@core/schema/ids';
import {MissingLiveTargetError} from '../commandErrors';
import type {LiveHistory} from '../history';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function setLayout(
  history: LiveHistory,
  {screenId, layoutId}: CommandOf<'stage.layout.set'>,
  {settings}: SliceContext,
): LiveHistory {
  const layouts = settings?.get('stage-layouts');
  const screens = settings?.get('screens');
  if (layouts?.name !== 'stage-layouts' || screens?.name !== 'screens') {
    throw new Error('Stage settings are unavailable');
  }
  if (!layouts.value.layouts.some(({id}) => id === layoutId)) {
    throw new MissingLiveTargetError({kind: 'stage-layout', id: layoutId});
  }
  const stageScreens = screens.value.screens.filter(
    ({kind}) => kind === 'stage',
  );
  if (screenId !== undefined && !stageScreens.some(({id}) => id === screenId)) {
    throw new MissingLiveTargetError({kind: 'screen', id: screenId});
  }
  const targets =
    screenId === undefined ? stageScreens.map(({id}) => id) : [screenId];
  const current = history.state.stageLayouts ?? {};
  if (targets.every(id => current[id] === layoutId)) return history;
  const stageLayouts: Record<string, StageLayoutId> = {...current};
  for (const id of targets) stageLayouts[id] = layoutId;
  return {
    ...history,
    state: {
      ...history.state,
      stageLayouts,
      version: history.state.version + 1,
    },
  };
}

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

/**
 * The 무대 화면's choices for this output: the stage layout per stage screen,
 * until the next Look change, and the 타이머 its 타이머 element shows.
 */
export const stageSlice = defineSlice({
  commands: ['stage.layout.set', 'stage.timer.set'],
  initial: {},
  reduce: (history, command, context) =>
    command.type === 'stage.layout.set'
      ? setLayout(history, command, context)
      : setTimer(history, command, context),
});
