import {
  ENTRY_TEST_TIMEOUT_MS,
  mocks,
  startMain,
  deferred,
  launchAgain,
  beforeQuit,
} from '@fixtures/main/indexWiringFixtures';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {MAIN_SCREEN} from '@fixtures/core/screenIds';

describe('main entry lifecycle', {timeout: ENTRY_TEST_TIMEOUT_MS}, () => {
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
    expect(mocks.zoomForControl).toEqual([mocks.zoom]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.appConfig.flush).toHaveBeenCalled());
    expect(mocks.zoom.dispose).toHaveBeenCalledOnce();
    expect(mocks.zoom.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appConfig.flush.mock.invocationCallOrder[0] ?? Infinity,
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

    expect(mocks.soakSources).toEqual([{frameRates: mocks.frameRates}]);
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
