import {
  projector,
  setup,
  loaded,
  mocks,
} from '@fixtures/main/outputs/startFixtures';
import type {SettingsReader} from '@core/schema/settingsReader';
import {describe, expect, it, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import {LiveStore} from '@main/live/store';
import {MAIN} from '@fixtures/core/overlays';

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

  it('keeps the display awake while an output is on', async () => {
    const {store} = setup();
    await loaded();

    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(
      'prevent-display-sleep',
    );
    store.dispatch({type: 'output.set', screenId: MAIN, on: false});
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
});
