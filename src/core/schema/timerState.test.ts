import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '../live/state';
import {parseLiveState} from './liveState';
import {MAX_LIVE_TIMERS} from './timerState';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const SINCE = 1_000_000;
const PAUSED = {
  state: 'paused',
  at: SINCE,
  countedMs: 0,
  day: SINCE,
  wallAt: SINCE,
};

function withTimers(timers: unknown) {
  return parseLiveState({...emptyLiveState(), timers});
}

describe('live 타이머 runs', () => {
  it('accepts an optional completed marker only on a paused run', () => {
    const completed = {...PAUSED, completed: true};
    const parsed = withTimers({[uuid(1)]: completed});
    expect(parsed.ok && Object.values(parsed.value.timers ?? {})).toEqual([
      completed,
    ]);
    for (const invalid of [false, 'true', null]) {
      expect(withTimers({[uuid(1)]: {...PAUSED, completed: invalid}}).ok).toBe(
        false,
      );
    }
  });
  it('keeps running and paused runs, and a state without any', () => {
    const timers = {
      [uuid(1)]: {state: 'running', since: SINCE, countedMs: 1500, day: SINCE},
      [uuid(2)]: {
        state: 'paused',
        at: SINCE,
        countedMs: 0,
        day: SINCE,
        wallAt: SINCE,
      },
    };
    expect(withTimers(timers)).toEqual({
      ok: true,
      value: {...emptyLiveState(), timers},
    });
    expect(parseLiveState(emptyLiveState()).ok).toBe(true);
  });

  it('drops unknown fields of a run', () => {
    const parsed = withTimers({
      [uuid(1)]: {...PAUSED, extra: true},
    });
    expect(parsed.ok && parsed.value.timers).toEqual({[uuid(1)]: PAUSED});
  });

  it.each([
    [
      'a key that is not a 타이머 id',
      {main: {state: 'paused', at: 1, countedMs: 0}},
    ],
    ['an unknown state', {[uuid(1)]: {state: 'stopped', countedMs: 0}}],
    [
      'a running run without its start',
      {[uuid(1)]: {state: 'running', countedMs: 0}},
    ],
    ['a negative count', {[uuid(1)]: {...PAUSED, countedMs: -1}}],
    [
      'a pause without its wall time',
      {[uuid(1)]: {state: 'paused', at: 1, countedMs: 0, day: 1}},
    ],
    [
      'a run without its day',
      {[uuid(1)]: {state: 'running', since: 1, countedMs: 0}},
    ],
    [
      'a time that is not a number',
      {[uuid(1)]: {state: 'running', since: '1', countedMs: 0}},
    ],
    ['an array', [{state: 'paused', at: 1, countedMs: 0}]],
    ['null', null],
  ])('refuses %s', (_case, timers) => {
    expect(withTimers(timers).ok).toBe(false);
  });

  it('holds at most the cap of runs', () => {
    const runs = (count: number) =>
      Object.fromEntries(
        Array.from({length: count}, (_, index) => [uuid(index + 1), PAUSED]),
      );
    expect(withTimers(runs(MAX_LIVE_TIMERS)).ok).toBe(true);
    expect(withTimers(runs(MAX_LIVE_TIMERS + 1)).ok).toBe(false);
  });
});
