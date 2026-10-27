import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {MAX_LIVE_TIMERS} from '@shared/schema/timerState';
import {createTimerId} from '@shared/schema/ids';
import {recordingLogger} from '../displays/testing';
import {startOverlays} from './overlays';
import {dispatchLogged, LiveStore} from './store';
import {
  overlaySettings,
  overlayUuid,
  settingsDocument,
} from './testing/overlays';

const A = createTimerId(overlayUuid(90));
const B = createTimerId(overlayUuid(91));
const C = createTimerId(overlayUuid(92));
const WALL = new Date(2026, 9, 27, 10).getTime();
const definitions = [
  {id: A, name: 'Pause', kind: 'countdown', duration: 30, overrun: false},
  {id: B, name: 'Run', kind: 'countdown', duration: 40},
  {id: C, name: 'Keep', kind: 'countdown', duration: 50},
];
const stops: Array<() => void> = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.useRealTimers();
});

async function setup(timers: readonly object[] = definitions) {
  const settings = overlaySettings();
  const update = (value: readonly object[]) =>
    settings.update(settingsDocument('timers', {timers: value}, 2));
  update(timers);
  const store = new LiveStore(undefined, {
    wall: () => WALL + performance.now(),
    timer: () => performance.now(),
  });
  const log = recordingLogger();
  const stop = startOverlays({
    store,
    settings: Promise.resolve(settings.reader),
    log,
    now: () => WALL + performance.now(),
  });
  stops.push(stop);
  await Promise.resolve();
  const send = (value: unknown) => {
    const command = parseLiveCommand(value);
    if (!command.ok) throw Error('Invalid fixture command');
    return dispatchLogged(store, command.value, log);
  };
  return {settings, update, store, send, log, stop};
}

it('drops removed running and paused timers while preserving a retained run and clearing a removed stage pick', async () => {
  const f = await setup();
  f.send({
    type: 'live.batch',
    commands: [
      {type: 'timer.start', timerId: A},
      {type: 'timer.start', timerId: B},
    ],
  });
  await vi.advanceTimersByTimeAsync(1200);
  f.send({type: 'timer.pause', timerId: A});
  f.send({type: 'timer.start', timerId: C});
  f.send({type: 'stage.timer.set', timerId: A});
  const kept = f.store.state.timers?.[C];
  f.update(definitions.filter(t => t.id === C));
  expect(Object.keys(f.store.state.timers ?? {})).toEqual([C]);
  expect(f.store.state.timers?.[C]).toBe(kept);
  expect(f.store.state.stageTimerId).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
  const beforeRename = f.store.state;
  f.update([{id: C, name: 'Renamed', kind: 'countdown', duration: 50}]);
  expect(f.store.state).toBe(beforeRename);
  f.update(definitions);
  expect(f.send({type: 'timer.start', timerId: A})).toBe(true);
  expect(f.store.state.timers?.[A]).toMatchObject({
    state: 'running',
    countedMs: 0,
  });
  expect(f.log.entries).toEqual([]);
});

it('reclaims every live slot after deleting a full library and permits a new timer', async () => {
  const timers = Array.from({length: MAX_LIVE_TIMERS}, (_, n) => ({
    id: overlayUuid(n + 1000),
    name: 'Fixture',
    kind: 'countdown',
    duration: 30,
  }));
  const f = await setup(timers);
  f.send({
    type: 'live.batch',
    commands: timers.map(timer => ({type: 'timer.start', timerId: timer.id})),
  });
  f.send({type: 'stage.timer.set', timerId: timers[0]?.id});
  expect(Object.keys(f.store.state.timers ?? {})).toHaveLength(MAX_LIVE_TIMERS);
  f.update([]);
  expect(Object.keys(f.store.state.timers ?? {})).toHaveLength(0);
  expect(f.store.state.stageTimerId).toBeUndefined();
  f.update([{id: A, name: 'New', kind: 'elapsed', start: 0}]);
  expect(f.send({type: 'timer.start', timerId: A})).toBe(true);
  expect(Object.keys(f.store.state.timers ?? {})).toEqual([A]);
  expect(f.log.entries).toEqual([]);
});

it('ignores other settings and releases its definition subscription on dispose', async () => {
  const f = await setup();
  f.send({type: 'timer.start', timerId: B});
  const before = f.store.state;
  f.settings.update(settingsDocument('notices', {sets: []}));
  expect(f.store.state).toBe(before);
  f.stop();
  f.update([]);
  expect(f.store.state).toBe(before);
  expect(f.settings.listeners.size).toBe(0);
  expect(f.store.listenerCount).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
