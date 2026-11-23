import {
  ENTRY_TEST_TIMEOUT_MS,
  beforeQuit,
  deferred,
  launchAgain,
  mocks,
  opens,
  startMain,
} from '@fixtures/main/indexWiringFixtures';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {describe, expect, it, vi} from 'vitest';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';

describe('main entry lifecycle', {timeout: ENTRY_TEST_TIMEOUT_MS}, () => {
  it('waits for the splash first paint before starting the control window', async () => {
    const painted: {current?: () => void} = {};
    mocks.splash.once.mockImplementation((_event, callback) => {
      painted.current = callback;
    });
    const starting = startMain();
    await vi.waitFor(() => expect(painted.current).toBeDefined());
    expect(mocks.opened.control).toBeNull();
    painted.current?.();
    expect(await starting).toBeTruthy();
  });

  it('follows the page of the control window on the bar', async () => {
    const control = await startMain();
    expect(mocks.barEnd).toHaveBeenCalledWith('window', false);
    expect(mocks.barEnd).not.toHaveBeenCalledWith('page', false);
    control.webContents.emit('dom-ready');
    expect(mocks.barAdvance).toHaveBeenLastCalledWith('page', 1, 3);
    control.webContents.emit('did-finish-load');
    control.emit('ready-to-show');
    expect(mocks.barEnd).toHaveBeenLastCalledWith('page', false);
  });

  it('closes the splash when the control window opens', async () => {
    await startMain();
    expect(mocks.splash.close).not.toHaveBeenCalled();
    opens(0);
    expect(mocks.splash.close).toHaveBeenCalledOnce();
  });

  it('hands off to the replacement control window after startup GPU recovery', async () => {
    const original = await startMain();
    await vi.waitFor(() =>
      expect(mocks.outputContexts.length).toBeGreaterThan(0),
    );
    for (const handler of mocks.appHandlers.get('child-process-gone') ?? []) {
      handler({}, {type: 'GPU', reason: 'crashed', exitCode: 1});
    }
    await vi.waitFor(() => expect(mocks.opened.control).not.toBe(original));
    const replacement = mocks.opened.control;
    if (!(replacement instanceof EventEmitter)) {
      throw new Error('Missing replacement control window');
    }
    opens(0);
    expect(mocks.splash.close).not.toHaveBeenCalled();
    opens(1);
    expect(mocks.splash.close).toHaveBeenCalledOnce();
  });

  it('closes the splash and reports a control page load failure', async () => {
    const control = await startMain();
    control.webContents.emit('did-fail-load', {}, -3, 'aborted', '', true);
    control.webContents.emit('did-fail-load', {}, -2, 'failed', '', false);
    expect(mocks.splash.close).not.toHaveBeenCalled();
    control.webContents.emit('did-fail-load', {}, -2, 'failed', '', true);
    expect(mocks.barEnd).toHaveBeenCalledWith('page', true);
    expect(mocks.splash.close).toHaveBeenCalledOnce();
    expect(mocks.electron.dialog.showErrorBox).toHaveBeenCalledWith(
      '시작 오류',
      expect.stringContaining('화면을 불러오지 못했습니다'),
    );
    expect(mocks.electron.app.quit).toHaveBeenCalled();
  });

  it('reads the UI state before the control window opens', async () => {
    await startMain();
    expect(mocks.order).toEqual([
      'recovery session',
      'app.json',
      'ui state',
      'UI zoom',
      'data store',
      'control window',
    ]);
  });

  it('passes the shared zoom registration only to the control window and disposes it before saving app.json', async () => {
    await startMain();
    expect(mocks.zoomForControl).toHaveLength(1);
    expect(mocks.zoomForControl[0]).toHaveProperty('outputsReady');
    expect(mocks.zoomForControl[0]).toHaveProperty('attachControl');
    beforeQuit();
    await vi.waitFor(() => expect(mocks.appConfig.flush).toHaveBeenCalled());
    expect(mocks.zoom.dispose).toHaveBeenCalledOnce();
    expect(mocks.zoom.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appConfig.flush.mock.invocationCallOrder[0] ?? Infinity,
    );
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
  });

  it('gives the data store the app.json it opened first', async () => {
    await startMain();

    expect(mocks.storeOptions[0]).toHaveProperty('appConfig', mocks.appConfig);
  });

  it('saves app.json on quit, after the UI state', async () => {
    const ui = deferred();
    mocks.uiDispose.mockReturnValue(ui.promise);
    mocks.soakStop.mockResolvedValue(undefined);
    await startMain();

    beforeQuit();
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.appConfig.flush).not.toHaveBeenCalled();
    ui.resolve();

    await vi.waitFor(() => {
      expect(mocks.appConfig.flush).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
  });

  it('serves media through the data store lookup', async () => {
    await startMain();

    expect(mocks.mediaOptions).toHaveLength(1);
    expect(mocks.mediaOptions[0]).toHaveProperty(
      'resolvePath',
      mocks.findMediaFile,
    );
    expect(mocks.mediaOptions[0]).toHaveProperty(
      'mediaRoots',
      mocks.mediaRoots,
    );
  });

  it('shares media analysis with the media scheme and the backend, and stops it after the backend', async () => {
    await startMain();
    expect(mocks.analysisOptions).toMatchObject([
      {
        thumbnailFolder: join(
          mocks.electron.app.getPath('userData'),
          'cache',
          'thumbnails',
        ),
      },
    ]);
    expect(mocks.mediaBackendContexts[0]?.analysis).toBe(mocks.analysis);
    expect(mocks.mediaBackendContexts[0]?.uiState).toBe(mocks.appConfig);
    expect(mocks.mediaOptions[0]?.analysisFile?.('token')).toBe('a.mp4');
    expect(await mocks.mediaOptions[0]?.thumbnail?.('id')).toBe('thumb.jpg');
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.analysis.dispose).toHaveBeenCalledOnce(),
    );
    expect(mocks.mediaBackendStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.analysis.dispose.mock.invocationCallOrder[0] ?? -Infinity,
    );
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
  });

  it('asks to quit when the control window closes', async () => {
    const control = await startMain();
    control.emit('closed');
    expect(mocks.electron.app.quit).toHaveBeenCalledTimes(1);
  });

  it('holds the quit until the UI state and the soak record are written', async () => {
    const ui = deferred();
    const soak = deferred();
    mocks.uiDispose.mockReturnValue(ui.promise);
    mocks.soakStop.mockReturnValue(soak.promise);
    await startMain();
    expect(beforeQuit().prevented).toBe(true);
    expect(beforeQuit().prevented).toBe(true);
    ui.resolve();
    await ui.promise;
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.electron.app.quit).not.toHaveBeenCalled();
    soak.resolve();
    await vi.waitFor(() => {
      expect(mocks.electron.app.quit).toHaveBeenCalledTimes(1);
    });
    expect(mocks.uiDispose).toHaveBeenCalledTimes(1);
    expect(mocks.storeDispose).toHaveBeenCalledTimes(1);
    expect(mocks.electron.app.releaseSingleInstanceLock).toHaveBeenCalled();
    expect(beforeQuit().prevented).toBe(false);
  });

  it('still quits when saving fails', async () => {
    mocks.uiDispose.mockRejectedValue(new Error('disk full'));
    mocks.soakStop.mockResolvedValue(undefined);
    await startMain();
    beforeQuit();
    await vi.waitFor(() => {
      expect(mocks.electron.app.quit).toHaveBeenCalled();
    });
  });

  it('restores and focuses the control window on a second launch', async () => {
    await startMain();

    launchAgain();

    expect(mocks.controlWindow.restore).toHaveBeenCalledTimes(1);
    expect(mocks.controlWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('keeps an offscreen control window hidden on a second launch', async () => {
    mocks.electron.app.isPackaged = false;
    vi.stubEnv('LLP_TEST_WINDOWS', 'offscreen');
    await startMain();

    launchAgain();

    expect(mocks.controlWindow.restore).not.toHaveBeenCalled();
    expect(mocks.controlWindow.focus).not.toHaveBeenCalled();
  });

  it("gives the soak recorder the outputs' frame rates", async () => {
    await startMain();

    expect(mocks.soakSources).toHaveLength(1);
    const source = mocks.soakSources[0];
    const hasFrameRates = (
      value: unknown,
    ): value is {frameRates: () => unknown} =>
      typeof value === 'object' &&
      value !== null &&
      'frameRates' in value &&
      typeof value.frameRates === 'function';
    if (!hasFrameRates(source)) {
      throw new Error('Missing frame rate source');
    }
    source.frameRates();
    expect(mocks.frameRates).toHaveBeenCalledOnce();
  });

  it('lets the soak scenario change the live state', async () => {
    const saved = deferred();
    mocks.recordPersistOutputs.mockImplementation(async () => {
      await saved.promise;
      return true;
    });
    await startMain();
    const store = mocks.outputContexts[0]?.store;

    mocks.scenarioDispatch.current?.({
      type: 'output.set',
      screenId: MAIN_SCREEN,
      on: true,
    });

    expect(mocks.recordPersistOutputs).toHaveBeenCalledWith(
      expect.objectContaining({outputs: {[MAIN_SCREEN]: true}}),
    );
    expect(store?.state.outputs[MAIN_SCREEN]).not.toBe(true);
    saved.resolve();
    await store?.settled();
    expect(store?.state.outputs).toEqual({[MAIN_SCREEN]: true});
  });

  it('stops the soak scenario before the outputs when quitting', async () => {
    const stopped: string[] = [];
    mocks.scenarioStop.mockImplementation(() => {
      stopped.push('soak scenario');
    });
    mocks.outputsStop.mockImplementation(() => {
      stopped.push('outputs');
    });
    mocks.uiDispose.mockResolvedValue(undefined);
    mocks.soakStop.mockResolvedValue(undefined);
    mocks.storeDispose.mockResolvedValue(undefined);
    await startMain();

    beforeQuit();

    await vi.waitFor(() => {
      expect(mocks.electron.app.quit).toHaveBeenCalled();
    });
    expect(stopped).toEqual(['soak scenario', 'outputs']);
  });

  it('quits when the last window closes, through the same shutdown', async () => {
    await startMain();
    for (const handler of mocks.appHandlers.get('window-all-closed') ?? []) {
      handler();
    }
    expect(mocks.electron.app.quit).toHaveBeenCalledTimes(1);
  });
});
