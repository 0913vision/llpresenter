import {
  projector,
  stage,
  savedDisplay,
  main,
  setup,
  loaded,
  mocks,
} from './testing/startFixtures';
import {settingsDocument} from '@core/testing/settingsDocument';
import type {SettingsReader} from '@core/schema/settingsReader';
import {describe, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {dispatchLogged, LiveStore} from '../live/store';
import {MAIN, STAGE} from '@core/testing/overlays';

describe('saved output backend', () => {
  it('continues past a throwing stop callback and disposes outputs after on then off', async () => {
    const {store, windows, controlWindow, stop, settings, log} = setup();
    await loaded();
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    const output = windows.only(MAIN);
    store.dispatch({type: 'output.set', screenId: MAIN, on: false});
    expect(output.destroyed).toBe(false);
    const failure = new Error('Stop callback failed');
    vi.spyOn(controlWindow, 'removeListener').mockImplementationOnce(() => {
      throw failure;
    });
    expect(stop).not.toThrow();
    expect(output.destroyed).toBe(true);
    expect(store.listenerCount).toBe(0);
    expect(settings.listeners.size).toBe(0);
    expect(mocks.displays?.watcherCount).toBe(0);
    expect(mocks.answers.size).toBe(0);
    expect(log.entries).toContainEqual({
      level: 'error',
      message: 'could not release an output resource',
      detail: failure,
    });
    stop();
  });
  it.each(['refused', 'failed'] as const)(
    'keeps the built-in output usable when settings are %s',
    async reason => {
      const loading =
        reason === 'refused'
          ? Promise.resolve(null)
          : Promise.reject(new Error('cannot open settings'));
      const {store, windows, running, log} = setup(loading);
      store.dispatch({type: 'output.set', screenId: 'main', on: true});
      await loaded();
      expect(store.state.outputs.main).toBe(true);
      const output = windows.only('main');
      expect(output.mode).toEqual({
        kind: 'fullscreen',
        bounds: projector.bounds,
        alwaysOnTop: false,
      });
      expect(log.messages('warn')).toContain(
        'using built-in output screens because settings are unavailable',
      );
      mocks.handlers.get(outputEndpoints.frameRate.channel)?.(
        {screenId: 'main', fps: 60},
        1,
      );
      expect(running.frameRates()).toEqual([{screen: 'main', fps: 60}]);
      store.dispatch({type: 'output.set', screenId: 'main', on: false});
      expect(output.mode.kind).toBe('hidden');
      store.dispatch({type: 'output.set', screenId: 'main', on: true});
      expect(output.mode.kind).toBe('fullscreen');
      expect(windows.created).toHaveLength(1);
    },
  );

  it('keeps the single settings owner attached when only outputs stop', async () => {
    const connect = vi.spyOn(LiveStore.prototype, 'connectSettings');
    const {store, settings, running, stopOverlays} = setup();
    await loaded();
    expect(connect).toHaveBeenCalledTimes(1);
    running.stop();
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(store.state.outputs).toEqual({[MAIN]: true, main: true});
    stopOverlays();
    expect(settings.listeners.size).toBe(0);
    expect(store.listenerCount).toBe(0);
  });
  it('reads saved settings by ID for resync and coalesces refreshes after the live transaction', async () => {
    const {settings, store, log, running, windows} = setup();
    await loaded();
    const command = parseLiveCommand({
      type: 'screen.settings.apply',
      screenId: MAIN,
      screen: {...main, method: 'window'},
    });
    if (!command.ok || command.value.type !== 'screen.settings.apply') {
      throw new Error('Invalid resync fixture');
    }
    const read = settings.reader.get.bind(settings.reader);
    const saved = settingsDocument('screens', {
      screens: [
        {...main, method: 'capture', resolution: {width: 1280, height: 720}},
      ],
    });
    const get = vi
      .spyOn(settings.reader, 'get')
      .mockImplementation(name => (name === 'screens' ? saved : read(name)));
    const broadcasts = vi.fn();
    store.subscribe(broadcasts);
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [
          command.value,
          command.value,
          {type: 'output.set', screenId: MAIN, on: true},
        ],
      },
      log,
    );
    expect(broadcasts).toHaveBeenCalledTimes(1);
    expect(windows.only(MAIN).mode.kind).toBe('fullscreen');
    get.mockClear();
    await loaded();
    expect(get.mock.calls.filter(([name]) => name === 'screens')).toHaveLength(
      1,
    );
    expect(store.state.outputs[MAIN]).toBe(true);
    expect(windows.only(MAIN).mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 1280, height: 720},
    });
    expect(broadcasts).toHaveBeenCalledTimes(1);
    const before = store.state;
    dispatchLogged(
      store,
      {type: 'screen.settings.apply', screenId: STAGE},
      log,
    );
    expect(store.state).toBe(before);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'warn',
      detail: {reason: 'missing-target', target: {kind: 'screen', id: STAGE}},
    });
    running.stop();
    dispatchLogged(store, command.value, log);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'error',
      message: 'live command failed',
    });
  });

  it('applies method, monitor, resolution and always-on-top changes to the same window', async () => {
    const {save, store, windows} = setup();
    await loaded();
    const broadcasts = vi.fn();
    store.subscribe(broadcasts);
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(store.state.outputs).toEqual({[MAIN]: true, main: true});
    expect(broadcasts).toHaveBeenCalledTimes(1);
    const window = windows.only(MAIN);
    expect(window.mode).toEqual({
      kind: 'fullscreen',
      bounds: projector.bounds,
      alwaysOnTop: false,
    });
    save([
      {...main, method: 'capture', resolution: {width: 1280, height: 720}},
    ]);
    expect(window.mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 1280, height: 720},
    });
    expect(window.mode).not.toHaveProperty('alwaysOnTop', true);
    save([
      {
        ...main,
        method: 'capture',
        resolution: {width: 3840, height: 2160},
        alwaysOnTop: true,
      },
    ]);
    expect(window.mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 3840, height: 2160},
      alwaysOnTop: true,
    });
    save([{...main, method: 'window', alwaysOnTop: true}]);
    expect(window.mode).toMatchObject({kind: 'window', alwaysOnTop: true});
    save([{...main, display: savedDisplay(stage), alwaysOnTop: false}]);
    expect(window.mode).toEqual({
      kind: 'fullscreen',
      bounds: stage.bounds,
      alwaysOnTop: false,
    });
    expect(windows.created).toHaveLength(1);
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(
      'prevent-display-sleep',
    );
    store.dispatch({type: 'output.set', screenId: MAIN, on: false});
    expect(store.state.outputs).toEqual({[MAIN]: false, main: false});
    expect(window.mode.kind).toBe('hidden');
    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('loads output commands queued before settings are ready', async () => {
    let resolve: (reader: SettingsReader) => void = () => undefined;
    const loading = new Promise<SettingsReader>(done => {
      resolve = done;
    });
    const {settings, store, windows, running} = setup(loading);
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(windows.created).toHaveLength(0);
    resolve(settings.reader);
    await loaded();
    expect(store.state.outputs).toEqual({[MAIN]: true, main: true});
    expect(windows.only(MAIN).mode.kind).toBe('fullscreen');
    running.stop();
    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('applies the latest placement to the preloaded hidden native handle', async () => {
    const {save, store, windows} = setup();
    await loaded();
    save([{...main, name: 'Updated', method: 'capture'}]);
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    expect(windows.only(MAIN).mode.kind).toBe('capture');
    expect(windows.only(MAIN).screen.name).toBe('Updated');
  });
});
