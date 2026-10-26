import {describe, expect, it, vi} from 'vitest';
import type {SingleLiveCommand} from '@shared/commands';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {MAX_LIVE_TIMERS} from '@shared/schema/timerState';
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

function setup(extraTimers: readonly object[] = []) {
  let now = 1_000_000;
  const store = new LiveStore(undefined, () => now);
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
      now += ms;
    },
    now: () => now,
  };
}

describe('timer slice', () => {
  it('starts, pauses with the counted time, and resumes from it', () => {
    const {store, advance, now} = setup();
    expect(store.dispatch(command('timer.start', SERMON))).toBe(true);
    expect(runOf(store, SERMON)).toEqual({
      state: 'running',
      since: now(),
      countedMs: 0,
    });
    advance(90 * SECOND);
    store.dispatch(command('timer.pause', SERMON));
    expect(runOf(store, SERMON)).toEqual({
      state: 'paused',
      at: now(),
      countedMs: 90 * SECOND,
    });
    advance(60 * SECOND);
    store.dispatch(command('timer.start', SERMON));
    expect(runOf(store, SERMON)).toEqual({
      state: 'running',
      since: now(),
      countedMs: 90 * SECOND,
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

  it('never counts a pause backwards when the clock steps back', () => {
    const {store, advance} = setup();
    store.dispatch(command('timer.start', SERMON));
    advance(-30 * SECOND);
    store.dispatch(command('timer.pause', SERMON));
    expect(runOf(store, SERMON)).toMatchObject({countedMs: 0});
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
