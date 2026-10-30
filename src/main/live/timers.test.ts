import {describe, expect, it, vi} from 'vitest';
import type {SingleLiveCommand} from '@core/live/commands';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {MAX_LIVE_TIMERS} from '@core/schema/timerState';
import {localDay, timerText} from '@core/timers/timerClock';
import {parseTimers} from '@core/schema/timers';
import {recordingLogger} from '../displays/testing';
import {dispatchLogged, LiveStore} from './store';
import {
  MAIN,
  overlaySettings,
  overlayUuid,
  settingsDocument,
} from './testing/overlays';

const SERMON = overlayUuid(90);
const CLOCK = overlayUuid(91);
const START_TIME = overlayUuid(92);
const SECOND = 1000;

function command(
  type: 'timer.start' | 'timer.pause' | 'timer.reset',
  timerId: string,
): SingleLiveCommand {
  const parsed = parseLiveCommand({type, timerId});
  if (!parsed.ok || parsed.value.type === 'live.batch') {
    throw new Error('Invalid timer command fixture');
  }
  return parsed.value;
}

function runOf(store: LiveStore, timerId: string) {
  return Object.entries(store.state.timers ?? {}).find(
    ([id]) => id === timerId,
  )?.[1];
}

const WALL_START = new Date(2026, 9, 26, 10, 0, 0).getTime();
const TIMER_START = 1_000_000;

function setup(extraTimers: readonly object[] = []) {
  let wall = WALL_START;
  let timer = TIMER_START;
  const store = new LiveStore(undefined, {
    wall: () => wall,
    timer: () => timer,
  });
  const settings = overlaySettings();
  settings.update(
    settingsDocument('timers', {
      timers: [
        {id: SERMON, name: '설교', kind: 'countdown', duration: 35 * 60},
        {id: CLOCK, name: '현재 시각', kind: 'clock'},
        {id: START_TIME, name: '예배 시작', kind: 'countdownTo', time: '11:00'},
        ...extraTimers,
      ],
    }),
  );
  store.connectSettings(settings.reader);
  return {
    store,
    advance: (ms: number) => {
      wall += ms;
      timer += ms;
    },
    stepWallClock: (ms: number) => {
      wall += ms;
    },
    timer: () => timer,
    wall: () => wall,
  };
}

describe('timer slice', () => {
  it.each([
    [{kind: 'elapsed', start: 30}, ['0:30', '0:32', '0:32', '0:33', '0:30']],
    [
      {kind: 'countdownTo', date: '2026-10-27', time: '10:00'},
      ['24:00:00', '23:59:58', '23:59:58', '23:59:47', '23:59:47'],
    ],
  ])(
    'starts, pauses, resumes and resets the new mode %j',
    (fields, expected) => {
      const id = overlayUuid(94);
      const parsed = parseTimers(
        JSON.stringify({
          format: 'llsettings.timers',
          schemaVersion: 1,
          timers: [{id, name: 'Fixture', ...fields}],
        }),
        'timers.json',
      );
      const definition = parsed.ok ? parsed.value.data.timers[0] : undefined;
      if (definition === undefined) throw new Error('Invalid timer fixture');
      const {store, advance, stepWallClock, timer, wall} = setup([definition]);
      const read = () =>
        timerText(definition, runOf(store, id), {timer: timer(), wall: wall()});
      const values = [read()];
      expect(store.dispatch(command('timer.start', id))).toBe(true);
      advance(2 * SECOND);
      expect(store.dispatch(command('timer.pause', id))).toBe(true);
      values.push(read());
      advance(10 * SECOND);
      values.push(read());
      expect(store.dispatch(command('timer.start', id))).toBe(true);
      advance(SECOND);
      values.push(read());
      expect(store.dispatch(command('timer.reset', id))).toBe(true);
      values.push(read());
      expect(values).toEqual(expected);
      if (definition.kind === 'elapsed') {
        store.dispatch(command('timer.start', id));
        advance(SECOND);
        stepWallClock(-60 * SECOND);
        expect(read()).toBe('0:31');
      }
    },
  );

  it('starts, pauses with the counted time, and resumes from it on its first day', () => {
    const {store, advance, timer, wall} = setup();
    const day = localDay(WALL_START);
    expect(store.dispatch(command('timer.start', SERMON))).toBe(true);
    expect(runOf(store, SERMON)).toEqual({
      state: 'running',
      since: timer(),
      countedMs: 0,
      day,
    });
    advance(90 * SECOND);
    store.dispatch(command('timer.pause', SERMON));
    expect(runOf(store, SERMON)).toEqual({
      state: 'paused',
      at: timer(),
      countedMs: 90 * SECOND,
      day,
      wallAt: wall(),
    });
    advance(24 * 60 * 60 * SECOND);
    store.dispatch(command('timer.start', SERMON));
    expect(runOf(store, SERMON)).toEqual({
      state: 'running',
      since: timer(),
      countedMs: 90 * SECOND,
      day,
    });
  });

  it('ignores a repeated start or pause and a reset of a stopped 타이머', () => {
    const {store} = setup();
    store.dispatch(command('timer.start', SERMON));
    const version = store.state.version;
    expect(store.dispatch(command('timer.start', SERMON))).toBe(false);
    expect(store.dispatch(command('timer.pause', START_TIME))).toBe(false);
    expect(store.dispatch(command('timer.reset', START_TIME))).toBe(false);
    expect(store.state.version).toBe(version);
  });

  it('keeps the moment of the first pause when paused again', () => {
    const {store, advance} = setup();
    store.dispatch(command('timer.start', START_TIME));
    store.dispatch(command('timer.pause', START_TIME));
    const paused = runOf(store, START_TIME);
    advance(60 * SECOND);
    expect(store.dispatch(command('timer.pause', START_TIME))).toBe(false);
    expect(runOf(store, START_TIME)).toBe(paused);
  });

  it('stops a 타이머 on reset and leaves the others running', () => {
    const {store} = setup();
    store.dispatch(command('timer.start', SERMON));
    store.dispatch(command('timer.start', START_TIME));
    store.dispatch(command('timer.reset', SERMON));
    expect(Object.keys(store.state.timers ?? {})).toEqual([START_TIME]);
  });

  it('keeps 타이머 running through every clear and its undo', () => {
    const {store} = setup();
    store.dispatch(command('timer.start', SERMON));
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'item', position: 0, label: null, lines: ['Fixture']},
    });
    const timers = store.state.timers;
    store.dispatch({type: 'layer.clear', target: 'all'});
    expect(store.state.timers).toBe(timers);
    store.dispatch({type: 'clear.undo'});
    expect(store.state.timers).toBe(timers);
  });

  it('counts on the monotonic clock when the wall clock steps back', () => {
    const {store, advance, stepWallClock} = setup();
    store.dispatch(command('timer.start', SERMON));
    advance(30 * SECOND);
    stepWallClock(-10 * SECOND);
    store.dispatch(command('timer.pause', SERMON));
    expect(runOf(store, SERMON)).toMatchObject({countedMs: 30 * SECOND});
  });

  it('has nothing to start on a clock and refuses a 타이머 that is gone', () => {
    const {store} = setup();
    expect(store.dispatch(command('timer.start', CLOCK))).toBe(false);
    const skipped = vi.fn();
    store.dispatch(command('timer.start', overlayUuid(93)), undefined, skipped);
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'missing-target'}),
    );
    expect(store.state.timers).toBeUndefined();
  });

  it('refuses a new 타이머 past the cap while the rest of a batch applies', () => {
    const many = Array.from({length: MAX_LIVE_TIMERS}, (_, index) => ({
      id: overlayUuid(1000 + index),
      name: `Fixture ${index}`,
      kind: 'countdown',
      duration: 60,
    }));
    const {store} = setup(many);
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: many.map(({id}) => command('timer.start', id)),
      },
      recordingLogger(),
    );
    expect(Object.keys(store.state.timers ?? {})).toHaveLength(MAX_LIVE_TIMERS);
    const log = recordingLogger();
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [
          command('timer.start', SERMON),
          {type: 'output.set', screenId: MAIN, on: true},
        ],
      },
      log,
    );
    expect(store.state.timers).not.toHaveProperty(SERMON);
    expect(store.state.outputs[MAIN]).toBe(true);
    expect(log.messages('warn')).toEqual(['skipped live command']);
  });
});
