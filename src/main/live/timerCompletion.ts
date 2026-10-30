import type {SingleLiveCommand} from '@core/live/commands';
import type {SettingsReader} from '../store/settingsStore';
import {
  countdownRemainingMs,
  stopsAtZero,
  type TimerNow,
} from '@core/timers/timerClock';
import type {LiveStore} from './store';

const RECHECK_MS = 250;

export function followTimerCompletion(options: {
  readonly store: LiveStore;
  readonly settings: SettingsReader;
  readonly now: () => TimerNow;
  readonly send: (command: SingleLiveCommand) => void;
  readonly onError: (error: unknown) => void;
}): {readonly refresh: () => void; readonly dispose: () => void} {
  let disposed = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
  };
  const candidates = () => {
    const runs = options.store.state.timers;
    if (!Object.values(runs ?? {}).some(run => run.state === 'running')) {
      return [];
    }
    const document = options.settings.get('timers');
    if (document.name !== 'timers') return [];
    return document.value.timers.flatMap(timer => {
      const run = runs?.[timer.id];
      return stopsAtZero(timer) && run?.state === 'running'
        ? [{timer, run}]
        : [];
    });
  };
  const refresh = (): void => {
    if (disposed) return;
    try {
      if (candidates().length === 0) {
        cancel();
        return;
      }
      if (timeout !== null) return;
      timeout = setTimeout(() => {
        timeout = null;
        try {
          const now = options.now();
          for (const {timer, run} of candidates()) {
            if (disposed) break;
            if (options.store.state.timers?.[timer.id] !== run) continue;
            if (countdownRemainingMs(timer, run, now) <= 0) {
              options.send({type: 'timer.pause', timerId: timer.id});
            }
          }
        } catch (error) {
          options.onError(error);
        }
        refresh();
      }, RECHECK_MS);
    } catch (error) {
      cancel();
      options.onError(error);
    }
  };
  const stop = options.store.subscribe(refresh);
  refresh();
  return {
    refresh,
    dispose: () => {
      disposed = true;
      cancel();
      stop();
    },
  };
}
