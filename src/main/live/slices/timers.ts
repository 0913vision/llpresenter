import type {TimerId} from '@shared/schema/ids';
import {MAX_LIVE_TIMERS, type TimerRun} from '@shared/schema/timerState';
import {countedMs, localDay} from '@shared/timerClock';
import {MissingLiveTargetError} from '../commandErrors';
import type {LiveHistory} from '../history';
import {defineSlice, type CommandOf, type SliceContext} from '../slice';

function withRuns(
  history: LiveHistory,
  runs: Readonly<Record<TimerId, TimerRun>>,
): LiveHistory {
  const {state} = history;
  return {
    ...history,
    state: {...state, timers: runs, version: state.version + 1},
  };
}

function start(
  history: LiveHistory,
  {timerId}: CommandOf<'timer.start'>,
  {settings, now, timerNow = now, reject}: SliceContext,
): LiveHistory {
  const document = settings?.get('timers');
  if (document?.name !== 'timers') {
    throw new Error('Timer settings are unavailable');
  }
  const timer = document.value.timers.find(({id}) => id === timerId);
  if (timer === undefined) {
    throw new MissingLiveTargetError({kind: 'timer', id: timerId});
  }
  const runs = history.state.timers ?? {};
  const run = runs[timerId];
  if (timer.kind === 'clock' || run?.state === 'running') return history;
  if (run === undefined && Object.keys(runs).length >= MAX_LIVE_TIMERS) {
    return reject({field: 'timers', message: 'Too many 타이머 are started'});
  }
  return withRuns(history, {
    ...runs,
    [timerId]: {
      state: 'running',
      since: timerNow,
      countedMs: run?.countedMs ?? 0,
      day: run?.day ?? localDay(now),
    },
  });
}

function pause(
  history: LiveHistory,
  {timerId}: CommandOf<'timer.pause'>,
  {now, timerNow = now}: SliceContext,
): LiveHistory {
  const runs = history.state.timers ?? {};
  const run = runs[timerId];
  if (run?.state !== 'running') return history;
  return withRuns(history, {
    ...runs,
    [timerId]: {
      state: 'paused',
      at: timerNow,
      countedMs: countedMs(run, timerNow),
      day: run.day,
      wallAt: now,
    },
  });
}

function reset(
  history: LiveHistory,
  {timerId}: CommandOf<'timer.reset'>,
): LiveHistory {
  const runs = history.state.timers ?? {};
  if (!Object.hasOwn(runs, timerId)) return history;
  return withRuns(
    history,
    Object.fromEntries(Object.entries(runs).filter(([id]) => id !== timerId)),
  );
}

/**
 * Starts, pauses, and resets 타이머: running time on the store's monotonic
 * 타이머 clock, the day and a pause on its wall clock. Clears never touch
 * them, and a 타이머 without a run is stopped (docs/spec/04-show.md).
 */
export const timersSlice = defineSlice({
  commands: ['timer.start', 'timer.pause', 'timer.reset'],
  initial: {},
  reduce: (history, command, context) => {
    switch (command.type) {
      case 'timer.start':
        return start(history, command, context);
      case 'timer.pause':
        return pause(history, command, context);
      case 'timer.reset':
        return reset(history, command);
    }
  },
});
