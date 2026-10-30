import {describe, expect, it} from 'vitest';
import {parseLiveState} from '@core/schema/liveState';
import {parseTimers} from '@core/schema/timers';
import {emptyLiveState} from '@core/live/state';
import {overlayUuid} from '../../../main/live/testing/overlays';
import {
  fillTimerTokens,
  hasTickingToken,
  type RenderTimers,
} from './timerTokens';

const SERMON = overlayUuid(97);
const CLOCK = overlayUuid(98);
const WALL = new Date(2026, 9, 26, 10, 0, 0).getTime();
const NOW = {timer: 1_000, wall: WALL};

function timersWith(runs: object): RenderTimers {
  const list = parseTimers(
    JSON.stringify({
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers: [
        {id: SERMON, name: '설교', kind: 'countdown', duration: 300},
        {id: CLOCK, name: '현재 시각', kind: 'clock'},
      ],
    }),
    'timers.json',
  );
  const state = parseLiveState({...emptyLiveState(), timers: runs});
  if (!list.ok || !state.ok) throw new Error('Invalid timer fixtures');
  return {
    list: list.value.data.timers,
    runs: state.value.timers,
    now: () => NOW,
  };
}

describe('timer tokens', () => {
  it('fills every token of a text', () => {
    const timers = timersWith({});
    expect(
      fillTimerTokens(
        `설교 {timer:${SERMON}} 지금 {timer:${CLOCK}}`,
        timers,
        NOW,
      ),
    ).toBe('설교 5:00 지금 10:00:00');
  });

  it('ticks for a running 타이머 or a clock, not for a stopped or paused one', () => {
    const stopped = timersWith({});
    const running = timersWith({
      [SERMON]: {state: 'running', since: 0, countedMs: 0, day: WALL},
    });
    const paused = timersWith({
      [SERMON]: {state: 'paused', at: 0, countedMs: 0, day: WALL, wallAt: WALL},
    });
    const sermon = `{timer:${SERMON}}`;
    expect(hasTickingToken(sermon, stopped)).toBe(false);
    expect(hasTickingToken(sermon, running)).toBe(true);
    expect(hasTickingToken(sermon, paused)).toBe(false);
    expect(hasTickingToken(`{timer:${CLOCK}}`, stopped)).toBe(true);
    expect(hasTickingToken('No token', running)).toBe(false);
  });
});
