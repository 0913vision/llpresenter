import {settingsDocument} from '@core/testing/settingsDocument';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {timerText} from '@core/timers/timerClock';
import {recordingLogger} from '../displays/testing';
import {startOverlays} from './overlays';
import {followTimerCompletion} from './timerCompletion';
import {LiveStore} from './store';
import {overlaySettings, overlayUuid} from '@core/testing/overlays';

const STOP = overlayUuid(90);
const CONTINUE = overlayUuid(91);
const WALL = new Date(2026, 9, 27, 10).getTime();
const SECOND = 1000;
const stops: Array<() => void> = [];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.useRealTimers();
});

async function setup(fields: object = {kind: 'countdown', duration: 1}) {
  let correction = 0;
  const wall = () => WALL + performance.now() + correction;
  const store = new LiveStore(undefined, {
    wall,
    timer: () => performance.now(),
  });
  const settings = overlaySettings();
  const update = (overrun = false, extra: object = {}) =>
    settings.update(
      settingsDocument('timers', {
        timers: [
          {id: STOP, name: 'Stop', ...fields, overrun, ...extra},
          {id: CONTINUE, name: 'Continue', ...fields},
        ],
      }),
    );
  update();
  const log = recordingLogger();
  const stop = startOverlays({
    store,
    settings: Promise.resolve(settings.reader),
    log,
    now: wall,
  });
  stops.push(stop);
  await Promise.resolve();
  const send = (
    type: 'timer.start' | 'timer.pause' | 'timer.reset',
    timerId = STOP,
  ) => {
    const parsed = parseLiveCommand({type, timerId});
    if (!parsed.ok) throw new Error('Invalid timer fixture command');
    store.dispatch(parsed.value);
  };
  const run = () =>
    Object.entries(store.state.timers ?? {}).find(([id]) => id === STOP)?.[1];
  const value = () => {
    const document = settings.reader.get('timers');
    const definition =
      document.name === 'timers'
        ? document.value.timers.find(t => t.id === STOP)
        : undefined;
    if (definition === undefined) throw new Error('Missing fixture timer');
    return timerText(definition, run(), {
      wall: wall(),
      timer: performance.now(),
    });
  };
  return {
    store,
    settings,
    log,
    stop,
    send,
    run,
    value,
    update,
    stepWall: (ms: number) => {
      correction += ms;
    },
  };
}

describe('countdown completion lifecycle', () => {
  it('completes only stop-at-zero timers and starts a finished duration fresh', async () => {
    const env = await setup();
    env.send('timer.start');
    env.send('timer.start', CONTINUE);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(SECOND);
    expect(env.run()).toMatchObject({state: 'paused', completed: true});
    expect(env.value()).toBe('0:00');
    expect(
      Object.values(env.store.state.timers ?? {}).filter(
        r => r.state === 'running',
      ),
    ).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(SECOND);
    expect(env.value()).toBe('0:00');
    env.send('timer.start');
    expect(env.value()).toBe('0:01');
    vi.advanceTimersByTime(500);
    env.send('timer.pause');
    expect(env.run()).toMatchObject({state: 'paused', countedMs: 500});
    expect(env.run()).not.toHaveProperty('completed');
    env.send('timer.start');
    vi.advanceTimersByTime(500);
    expect(env.run()).toMatchObject({completed: true});
    env.send('timer.reset');
    expect(env.value()).toBe('0:01');
    expect(env.run()).toBeUndefined();
  });

  it('uses monotonic duration even when the wall clock jumps', async () => {
    const env = await setup();
    env.send('timer.start');
    env.stepWall(60 * SECOND);
    vi.advanceTimersByTime(500);
    expect(env.run()?.state).toBe('running');
    env.stepWall(-120 * SECOND);
    vi.advanceTimersByTime(500);
    expect(env.run()).toMatchObject({completed: true});
  });

  it('follows a dated wall target and holds zero after a correction back', async () => {
    const env = await setup({
      kind: 'countdownTo',
      date: '2026-10-27',
      time: '10:01',
    });
    env.send('timer.start');
    env.stepWall(61 * SECOND);
    vi.advanceTimersByTime(250);
    expect(env.run()).toMatchObject({state: 'paused', completed: true});
    env.stepWall(-120 * SECOND);
    vi.advanceTimersByTime(SECOND);
    expect(env.value()).toBe('0:00');
    env.send('timer.reset');
    expect(env.value()).toBe('1:58');
  });

  it('uses edited settings and does not stop a reset or manually paused run', async () => {
    const env = await setup();
    env.send('timer.start');
    env.update(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2 * SECOND);
    expect(env.run()?.state).toBe('running');
    env.update(false);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(250);
    expect(env.run()).toMatchObject({completed: true});
    env.send('timer.reset');
    env.send('timer.start');
    vi.advanceTimersByTime(250);
    env.send('timer.pause');
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(SECOND);
    expect(env.run()).not.toHaveProperty('completed');
    env.send('timer.reset');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not apply a stale completion to a run restarted by an earlier notification', async () => {
    const env = await setup({kind: 'countdown', duration: 1, overrun: false});
    env.send('timer.start');
    env.send('timer.start', CONTINUE);
    let restarted = false;
    stops.push(
      env.store.subscribe(() => {
        const run = env.run();
        if (restarted || run?.state !== 'paused' || run.completed !== true) {
          return;
        }
        restarted = true;
        env.send('timer.reset', CONTINUE);
        env.send('timer.start', CONTINUE);
      }),
    );
    vi.advanceTimersByTime(SECOND);
    expect(restarted).toBe(true);
    const other = Object.entries(env.store.state.timers ?? {}).find(
      ([id]) => id === CONTINUE,
    )?.[1];
    expect(other).toMatchObject({state: 'running', countedMs: 0});
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps one timer through repeated commands and disposes every subscription', async () => {
    const env = await setup();
    for (let n = 0; n < 20; n++) {
      env.send('timer.start');
      expect(vi.getTimerCount()).toBe(1);
      for (let step = 0; step < 10; step++) {
        env.store.dispatch({type: 'stage.message.set', text: String(step)});
        vi.advanceTimersByTime(100);
      }
      expect(env.run()).toMatchObject({completed: true});
      expect(vi.getTimerCount()).toBe(0);
      env.send('timer.reset');
    }
    env.send('timer.start');
    env.stop();
    env.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(env.store.listenerCount).toBe(0);
    expect(env.settings.listeners.size).toBe(0);
    vi.advanceTimersByTime(2 * SECOND);
    expect(env.run()?.state).toBe('running');
    expect(env.log.entries).toEqual([]);
  });

  it('cancels scheduling when the definition is removed', async () => {
    const env = await setup();
    env.send('timer.start');
    env.settings.update(settingsDocument('timers', {timers: []}));
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2 * SECOND);
    expect(env.run()).toBeUndefined();
    expect(env.log.entries).toEqual([]);
  });

  it('stops an in-progress completion pass when disposed by a notification', async () => {
    const env = await setup({kind: 'countdown', duration: 1, overrun: false});
    env.send('timer.start');
    env.send('timer.start', CONTINUE);
    stops.push(
      env.store.subscribe(() => {
        const run = env.run();
        if (run?.state === 'paused' && run.completed === true) env.stop();
      }),
    );
    vi.advanceTimersByTime(SECOND);
    const other = Object.entries(env.store.state.timers ?? {}).find(
      ([id]) => id === CONTINUE,
    )?.[1];
    expect(other?.state).toBe('running');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs a failed settings read without throwing or registering a retry loop', async () => {
    const env = await setup();
    env.send('timer.start');
    env.stop();
    const failure = new Error('Fixture read failure');
    const onError = vi.fn();
    const send = vi.fn();
    const completion = followTimerCompletion({
      store: env.store,
      settings: {
        ...env.settings.reader,
        get: () => {
          throw failure;
        },
      },
      now: () => ({wall: WALL, timer: 0}),
      send,
      onError,
    });
    stops.push(completion.dispose);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(vi.getTimerCount()).toBe(0);
    expect(send).not.toHaveBeenCalled();
    completion.dispose();
    expect(env.store.listenerCount).toBe(0);
  });
});
