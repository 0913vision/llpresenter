import {afterEach, expect, it, vi} from 'vitest';
import {
  MockDisplaySource,
  displayInfo,
  recordingLogger,
} from '@fixtures/main/displays/testing';
import {fullScreenScreen, mockWindows} from '@fixtures/main/outputs/testing';
import {IdentityDisplaySource} from '@main/displays/identitySource';
import {DisplayRegistry} from '@main/displays/registry';
import {LiveStore} from '@main/live/store';
import {OutputManager} from '@main/outputs/manager';

afterEach(() => vi.useRealTimers());

it('survives a removal and twenty metrics events while identity lookup is slow or fails', async () => {
  vi.useFakeTimers();
  const mainId = '00000000-0000-4000-8000-000000000001';
  const stageId = '00000000-0000-4000-8000-000000000003';
  const control = displayInfo({id: 1, primary: true});
  const projector = displayInfo({id: 2, x: 1920, name: 'Projector'});
  const stage = displayInfo({id: 3, x: 3840, name: 'Stage'});
  const raw = new MockDisplaySource(control, projector, stage);
  const read = vi.spyOn(raw, 'read');
  let fail: (error: Error) => void = () => {};
  const query = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockImplementation(
      (signal: AbortSignal) =>
        new Promise((_, reject) => {
          fail = reject;
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    );
  const log = recordingLogger();
  const source = new IdentityDisplaySource({
    source: raw,
    query,
    pixelBounds: value => value.bounds,
    log,
  });
  const displays = new DisplayRegistry(source, log);
  const store = new LiveStore();
  const windows = mockWindows();
  const screens = [
    fullScreenScreen({
      id: mainId,
      display: {id: 2, name: projector.name, bounds: projector.bounds},
    }),
    fullScreenScreen({
      id: stageId,
      display: {id: 3, name: stage.name, bounds: stage.bounds},
    }),
  ];
  const manager = new OutputManager({
    store,
    displays,
    screens: {list: () => screens},
    controlBounds: () => control.bounds,
    createHandle: windows.create,
    log,
  });
  manager.start();
  store.dispatch({type: 'output.set', screenId: mainId, on: true});
  store.dispatch({type: 'output.set', screenId: stageId, on: true});
  await vi.advanceTimersByTimeAsync(0);
  for (const id of [mainId, stageId]) {
    manager.frameReady(id, store.state.version, {
      ...windows.only(id).contentSize(),
      ready: true,
    });
    expect(windows.only(id).mode.kind).toBe('fullscreen');
  }
  expect(query).toHaveBeenCalledTimes(1);
  const reads = read.mock.calls.length;
  raw.remove(2);
  expect(manager.screenStates().get(mainId)?.placement).toBe('monitorMissing');
  expect(manager.screenStates().get(stageId)?.placement).toBe('fullscreen');
  expect(windows.only(mainId).mode.kind).toBe('window');
  expect(windows.only(stageId).mode.kind).toBe('fullscreen');
  expect(windows.only(mainId).monitorRemovals).toBeLessThanOrEqual(2);
  for (let i = 0; i < 20; i++) {
    raw.emit();
    await vi.advanceTimersByTimeAsync(50);
  }
  expect(query).toHaveBeenCalledTimes(1);
  expect(read.mock.calls.length).toBe(reads);
  await vi.advanceTimersByTimeAsync(300);
  expect(query).toHaveBeenCalledTimes(2);
  expect(manager.screenStates().get(mainId)?.placement).toBe('monitorMissing');
  fail(new Error('identity unavailable'));
  await vi.advanceTimersByTimeAsync(300);
  expect(
    log.messages('info').filter(message => message === 'monitors changed'),
  ).toHaveLength(2);
  raw.change(control, projector, stage);
  await vi.advanceTimersByTimeAsync(300);
  expect(manager.screenStates().get(mainId)?.placement).toBe('fullscreen');
  expect(manager.screenStates().get(stageId)?.placement).toBe('fullscreen');
  expect(
    log.messages('info').filter(message => message === 'monitors changed'),
  ).toHaveLength(3);
  manager.dispose();
  displays.dispose();
  expect(raw.watcherCount).toBe(0);
});
