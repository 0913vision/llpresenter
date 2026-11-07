import {
  ENTRY_TEST_TIMEOUT_MS,
  mocks,
  startMain,
  deferred,
  beforeQuit,
} from '@fixtures/main/indexWiringFixtures';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';

describe('main entry wiring', {timeout: ENTRY_TEST_TIMEOUT_MS}, () => {
  it('connects slide advance to live state and disposes its timer before data', async () => {
    await startMain();
    expect(mocks.slideAdvanceContexts).toHaveLength(1);
    expect(mocks.slideAdvanceContexts[0]).toHaveProperty('store');
    expect(mocks.slideAdvanceContexts[0]).toHaveProperty('data');
    expect(mocks.slidesProjectionContexts).toHaveLength(1);
    expect(mocks.slidesProjectionContexts[0]).toHaveProperty(
      'settings',
      mocks.settings,
    );
    expect(mocks.slideAdvanceContexts[0]).toHaveProperty(
      'projection',
      mocks.slidesProjection,
    );
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.slideAdvanceStop).toHaveBeenCalledOnce();
    expect(mocks.slidesProjection.dispose).toHaveBeenCalledOnce();
    expect(mocks.slideAdvanceStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('registers fonts for the control window and stops enumeration before closing data', async () => {
    const control = await startMain();
    expect(mocks.fontContexts).toHaveLength(1);
    expect(mocks.fontContexts[0]).toHaveProperty('control', control);
    expect(mocks.fontContexts[0]).toHaveProperty('log.warn');
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.fontsStop).toHaveBeenCalledOnce();
    expect(mocks.fontsStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('connects Bible IPC to the data store reader and stops IPC before closing data', async () => {
    await startMain();
    expect(mocks.bibleContexts).toEqual([
      expect.objectContaining({
        session: mocks.bible,
      }),
    ]);
    expect(mocks.bibleContexts[0]).toHaveProperty('log');
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.bibleStop).toHaveBeenCalledOnce();
    expect(mocks.bibleAiStop).toHaveBeenCalledOnce();
    expect(mocks.bibleAiStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordStop.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.bibleStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('starts a crashed session in standby and removes its marker after saving the data store', async () => {
    const finish = deferred();
    onTestFinished(finish.resolve);
    mocks.recovery.cleanExit.mockReturnValue(finish.promise);
    mocks.recovery.crashed = true;
    await startMain();
    expect(mocks.outputContexts[0]?.store.state.outputs).toEqual({});
    expect(mocks.macroContexts).toEqual([
      expect.objectContaining({launch: 'restore'}),
    ]);
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.recovery.cleanExit).toHaveBeenCalledOnce(),
    );
    expect(mocks.storeDispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recovery.cleanExit.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.electron.app.releaseSingleInstanceLock).not.toHaveBeenCalled();
    expect(mocks.electron.app.quit).not.toHaveBeenCalled();
    finish.resolve();
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
  });
  it('leaves a crashed launch, its record, and the held-back startup macros to recovery', async () => {
    mocks.recovery.crashed = true;
    await startMain();
    const userData = mocks.electron.app.getPath('userData');
    const file = join(userData, 'recovery', 'live.json');
    const store = mocks.outputContexts[0]?.store;
    expect(mocks.recordOptions).toMatchObject([{file, store}]);
    expect(mocks.recoveryOptions).toMatchObject([
      {
        crashed: true,
        file,
        store,
        record: mocks.writers[0],
        runStartupMacros: mocks.macrosStartFresh,
      },
    ]);
    expect(mocks.recoveryPorts).toHaveLength(1);
    expect(mocks.recoveryStart).toHaveBeenCalledOnce();
    expect(mocks.recordStart).not.toHaveBeenCalled();
  });

  it('starts recovery on a normal launch and marks quitting before anything else stops', async () => {
    const lastWrite = deferred();
    onTestFinished(lastWrite.resolve);
    mocks.recordSettled.mockReturnValue(lastWrite.promise);
    await startMain();
    expect(mocks.recoveryOptions).toMatchObject([{crashed: false}]);
    expect(mocks.recoveryStart).toHaveBeenCalledOnce();
    beforeQuit();
    await vi.waitFor(() => expect(mocks.recordSettled).toHaveBeenCalledOnce());
    const order = [
      mocks.recovery.markQuitting,
      mocks.recordStop,
      mocks.scenarioStop,
      mocks.outputsStop,
      mocks.appConfig.flush,
      mocks.storeDispose,
      mocks.recoveryChannelsStop,
      mocks.recordSettled,
    ].map(step => step.mock.invocationCallOrder[0] ?? Infinity);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(Number.isFinite)).toBe(true);
    expect(mocks.recovery.cleanExit).not.toHaveBeenCalled();
    lastWrite.resolve();
    await vi.waitFor(() =>
      expect(mocks.recovery.cleanExit).toHaveBeenCalledOnce(),
    );
  });

  it('connects macro execution to the shared live and data stores and stops it before closing data', async () => {
    await startMain();
    expect(mocks.macroContexts[0]).toHaveProperty('launch', 'normal');
    expect(mocks.macroContexts).toHaveLength(1);
    expect(mocks.macroContexts[0]).toHaveProperty(
      'store',
      mocks.outputContexts[0]?.store,
    );
    expect(mocks.macroContexts[0]).toHaveProperty(
      'data.settings',
      mocks.settings,
    );
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.macrosStop).toHaveBeenCalledOnce();
    expect(mocks.macrosStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('starts independent audio output and releases it before the data store', async () => {
    await startMain();
    expect(mocks.audioContexts).toEqual([
      expect.objectContaining({
        store: mocks.outputContexts[0]?.store,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.audioStop).toHaveBeenCalledOnce();
    expect(mocks.audioStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('connects overlay settings to the live store and stops overlays before closing the data store', async () => {
    await startMain();
    expect(mocks.overlayContexts).toEqual([
      expect.objectContaining({
        store: mocks.outputContexts[0]?.store,
        settings: mocks.settings,
      }),
    ]);
    expect(mocks.outputContexts).toEqual([
      expect.objectContaining({settings: mocks.settings}),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.overlaysStop).toHaveBeenCalledOnce();
    expect(mocks.overlaysStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('registers text import for the control window and removes its handlers on shutdown', async () => {
    await startMain();
    expect(mocks.textImportContexts).toEqual([
      expect.objectContaining({
        control: mocks.opened.control,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.textImportStop).toHaveBeenCalledOnce());
  });

  it('registers one settings window owner and disposes it before saving app.json', async () => {
    await startMain();
    expect(mocks.screensWindowContexts).toEqual([
      expect.objectContaining({
        control: mocks.opened.control,
        screens: {
          store: mocks.outputContexts[0]?.store,
          config: mocks.appConfig,
        },
        zoom: mocks.zoom,
        mode: 'normal',
      }),
    ]);
    const flushed = deferred();
    mocks.screensWindowClose.mockReturnValueOnce(
      flushed.promise.then(() => true),
    );
    beforeQuit();
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.confirmClose).not.toHaveBeenCalled();
    expect(mocks.storeDispose).not.toHaveBeenCalled();
    flushed.resolve();
    await vi.waitFor(() => expect(mocks.appConfig.flush).toHaveBeenCalled());
    expect(mocks.screensWindowStop).toHaveBeenCalledOnce();
    expect(mocks.screensWindowStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appConfig.flush.mock.invocationCallOrder.at(-1) ?? -Infinity,
    );
  });

  it('registers editor window owners with the control window and stops them at quit', async () => {
    await startMain();
    const context: unknown = expect.objectContaining({
      control: mocks.opened.control,
      config: mocks.appConfig,
      zoom: mocks.zoom,
      mode: 'normal',
    });
    expect(mocks.editorWindowContexts).toEqual([
      {name: 'song', context},
      {name: 'slides', context},
    ]);
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.editorWindowStops.song).toHaveBeenCalledOnce(),
    );
    expect(mocks.editorWindowStops.slides).toHaveBeenCalledOnce();
  });

  it('asks the control window to flush before saving and keeps running when it refuses', async () => {
    mocks.confirmClose.mockResolvedValueOnce(false);
    await startMain();
    expect(mocks.closeContexts).toEqual([
      expect.objectContaining({control: mocks.opened.control}),
    ]);
    expect(beforeQuit().prevented).toBe(true);
    await vi.waitFor(() => expect(mocks.confirmClose).toHaveBeenCalledOnce());
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.scenarioStop).not.toHaveBeenCalled();
    expect(mocks.uiDispose).not.toHaveBeenCalled();
    expect(mocks.electron.app.quit).not.toHaveBeenCalled();
    expect(beforeQuit().prevented).toBe(true);
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
    expect(mocks.confirmClose).toHaveBeenCalledTimes(2);
    expect(mocks.confirmClose.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.scenarioStop.mock.invocationCallOrder[0] ?? -Infinity,
    );
    expect(mocks.closeStop).toHaveBeenCalledOnce();
    expect(mocks.storeDispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.closeStop.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('reports the live store problems to the windows and stops on shutdown', async () => {
    await startMain();
    expect(mocks.problemContexts).toEqual([
      expect.objectContaining({store: mocks.outputContexts[0]?.store}),
    ]);
    expect(mocks.storeOptions[0]).toHaveProperty('problems', mocks.problemFeed);
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
    expect(mocks.problemsStop).toHaveBeenCalledOnce();
  });

  it('connects the media backend to the data store and the control window and stops it before closing data', async () => {
    await startMain();
    expect(mocks.mediaBackendContexts).toEqual([
      expect.objectContaining({
        control: mocks.opened.control,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.mediaBackendStop).toHaveBeenCalledOnce();
    expect(mocks.mediaBackendStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('registers theme output and releases it before closing data', async () => {
    await startMain();
    expect(mocks.themeOutputContexts).toMatchObject([
      {store: mocks.outputContexts[0]?.store},
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.themeOutputStop).toHaveBeenCalledOnce();
    expect(mocks.themeOutputStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});
