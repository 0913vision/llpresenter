import {describe, expect, it, vi} from 'vitest';
import type {SingleLiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import type {SettingsReader} from '@core/schema/settingsReader';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {overlaySettings} from '@fixtures/core/overlays';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {followMessageExpiry} from '@main/live/messageExpiry';
import {
  overlayRefreshCommands,
  timerRefreshCommands,
} from '@main/live/overlayRefresh';
import {startOverlays} from '@main/live/overlays';
import {dispatchBatched, type LiveStore} from '@main/live/store';
import {followTimerCompletion} from '@main/live/timerCompletion';

const parts = vi.hoisted(() => ({
  stopExpiry: vi.fn(),
  refresh: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('@main/live/messageExpiry', () => ({
  followMessageExpiry: vi.fn(() => parts.stopExpiry),
}));
vi.mock('@main/live/timerCompletion', () => ({
  followTimerCompletion: vi.fn(() => ({
    refresh: parts.refresh,
    dispose: parts.dispose,
  })),
}));
vi.mock('@main/live/overlayRefresh', () => ({
  overlayRefreshCommands: vi.fn(() => []),
  timerRefreshCommands: vi.fn(() => []),
}));
vi.mock('@main/live/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/live/store')>()),
  dispatchBatched: vi.fn(() => true),
}));

function mockStore() {
  const release = vi.fn();
  return {
    release,
    store: {
      state: emptyLiveState(),
      subscribe: vi.fn<LiveStore['subscribe']>(() => () => undefined),
      connectSettings: vi.fn<LiveStore['connectSettings']>(() => release),
      timerNow: vi.fn(() => 0),
      handles: vi.fn<LiveStore['handles']>(() => true),
      dispatch: vi.fn<LiveStore['dispatch']>(() => true),
    },
  };
}

async function started() {
  vi.clearAllMocks();
  const {store, release} = mockStore();
  const settings = overlaySettings();
  const log = recordingLogger();
  const stop = startOverlays({
    store,
    settings: Promise.resolve(settings.reader),
    log,
  });
  await Promise.resolve();
  await Promise.resolve();
  return {store, release, settings, log, stop};
}

describe('startOverlays', () => {
  it('follows message expiry at once, and connects the settings and timer completion once they are read', async () => {
    const {store, settings} = await started();

    expect(followMessageExpiry).toHaveBeenCalledWith(
      expect.objectContaining({store}),
    );
    expect(store.connectSettings).toHaveBeenCalledExactlyOnceWith(
      settings.reader,
    );
    expect(followTimerCompletion).toHaveBeenCalledWith(
      expect.objectContaining({store, settings: settings.reader}),
    );
  });

  it('refreshes the live overlays and 타이머 after a settings change', async () => {
    const {store, settings, log} = await started();
    const refresh: readonly SingleLiveCommand[] = [{type: 'notice.stop'}];
    vi.mocked(overlayRefreshCommands).mockReturnValueOnce(refresh);
    const timers = settingsDocument('timers', {timers: []});

    settings.update(timers);

    expect(overlayRefreshCommands).toHaveBeenCalledWith(store.state, timers);
    expect(timerRefreshCommands).toHaveBeenCalledWith(store.state, timers);
    expect(dispatchBatched).toHaveBeenCalledExactlyOnceWith(
      store,
      refresh,
      log,
    );
    expect(parts.refresh).toHaveBeenCalledOnce();
  });

  it('sends nothing when a settings change leaves the overlays as they are', async () => {
    const {settings} = await started();

    settings.update(settingsDocument('labels', {labels: []}));

    expect(dispatchBatched).not.toHaveBeenCalled();
    expect(parts.refresh).not.toHaveBeenCalled();
  });

  it('stops every part on dispose, once', async () => {
    const {release, settings, stop} = await started();

    stop();
    stop();

    expect(parts.stopExpiry).toHaveBeenCalledOnce();
    expect(parts.dispose).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(settings.listeners.size).toBe(0);
  });

  it('attaches nothing after an early dispose and logs settings that fail to load', async () => {
    vi.clearAllMocks();
    const {store} = mockStore();
    let finish: (reader: SettingsReader) => void = () => undefined;
    const log = recordingLogger();
    const stop = startOverlays({
      store,
      settings: new Promise<SettingsReader>(resolve => {
        finish = resolve;
      }),
      log,
    });
    stop();
    finish(overlaySettings().reader);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.connectSettings).not.toHaveBeenCalled();

    startOverlays({store, settings: Promise.reject(new Error('Load')), log});
    await vi.waitFor(() =>
      expect(log.messages('error')).toEqual([
        'could not connect overlay settings',
      ]),
    );
  });
});
