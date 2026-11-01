import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SingleLiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createTimerId} from '@core/schema/ids';
import {parseLiveState} from '@core/schema/liveState';
import type {SettingsReader} from '@core/schema/settingsReader';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {overlayUuid} from '@fixtures/core/overlays';
import type {LiveStore} from '@main/live/store';
import {followTimerCompletion} from '@main/live/timerCompletion';

const START = 1_000_000;
const STOPS = createTimerId(overlayUuid(90));
const CONTINUES = createTimerId(overlayUuid(91));
const timers = settingsDocument('timers', {
  timers: [
    {id: STOPS, name: 'Stops', kind: 'countdown', duration: 1, overrun: false},
    {id: CONTINUES, name: 'Continues', kind: 'countdown', duration: 1},
  ],
});
const running = {state: 'running', since: 0, countedMs: 0, day: 0};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

function withRuns(runs: object): LiveState {
  return expectSuccess(parseLiveState({...emptyLiveState(), timers: runs}));
}

function setup(initial: LiveState, settings?: Partial<SettingsReader>) {
  const listeners = new Set<(state: LiveState) => void>();
  let state = initial;
  const store = {
    get state() {
      return state;
    },
    subscribe: vi.fn<LiveStore['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const announce = (next: LiveState) => {
    state = next;
    for (const listener of listeners) listener(state);
  };
  const send = vi.fn<(command: SingleLiveCommand) => void>();
  const onError = vi.fn();
  const completion = followTimerCompletion({
    store,
    settings: {
      get: () => timers,
      preferences: vi.fn(),
      subscribe: () => () => undefined,
      ...settings,
    },
    now: () => ({wall: Date.now(), timer: Date.now() - START}),
    send,
    onError,
  });
  return {listeners, announce, send, onError, completion};
}

describe('followTimerCompletion', () => {
  it('pauses a stop-at-zero countdown once it reaches zero and leaves a continuing one', () => {
    const {send} = setup(withRuns({[STOPS]: running, [CONTINUES]: running}));

    vi.advanceTimersByTime(750);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'timer.pause',
      timerId: STOPS,
    });
  });

  it('checks only while a countdown runs', () => {
    const {announce} = setup(emptyLiveState());
    expect(vi.getTimerCount()).toBe(0);

    announce(withRuns({[STOPS]: running}));
    expect(vi.getTimerCount()).toBe(1);
    announce(
      withRuns({
        [STOPS]: {state: 'paused', at: 0, countedMs: 0, day: 0, wallAt: START},
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports settings that cannot be read and stops checking', () => {
    const {onError} = setup(withRuns({[STOPS]: running}), {
      get: () => {
        throw new Error('Settings gone');
      },
    });

    expect(onError).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases its timer and listener on dispose', () => {
    const {listeners, send, completion} = setup(withRuns({[STOPS]: running}));

    completion.dispose();
    vi.advanceTimersByTime(2_000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
