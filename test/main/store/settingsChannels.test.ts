import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {settingsEndpoints} from '@contracts/ipc/settings';
import type {EditResult} from '@core/schema/contentEdit';
import {defaultPreferences} from '@core/schema/preferences';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import type {SettingsListener} from '@core/schema/settingsReader';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerSettingsChannels} from '@main/store/settingsChannels';
import type {
  SettingsProblemListener,
  SettingsStore,
} from '@main/store/settingsStore';

type Handler = (event: unknown, value: unknown) => unknown;
const electron = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  send: vi.fn<(channel: string, value: unknown) => void>(),
}));
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: electron.send},
      },
    ],
  },
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      electron.handlers.set(channel, handler),
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
}));

function handler(channel: string): Handler {
  const found = electron.handlers.get(channel);
  if (found === undefined) throw new Error(`Missing handler ${channel}`);
  return found;
}

function documentOf(name: string, value: object): SettingsDocument {
  return expectSuccess(
    parseSettingsDocument({name, value, access: 'editable', revision: 1}),
  );
}

const labels = documentOf('labels', {
  format: 'llsettings.labels',
  schemaVersion: 1,
  labels: [],
});
const preferences = documentOf('preferences', {
  format: 'llsettings.preferences',
  schemaVersion: 1,
});

const labelsUpdate = {
  type: 'settings.update',
  name: 'labels',
  value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
  baseRevision: 1,
};

function mockStore() {
  const changes = new Set<SettingsListener>();
  const problems = new Set<SettingsProblemListener>();
  const store = {
    subscribe: vi.fn<SettingsStore['subscribe']>(listener => {
      changes.add(listener);
      return () => changes.delete(listener);
    }),
    subscribeProblems: vi.fn<SettingsStore['subscribeProblems']>(listener => {
      problems.add(listener);
      return () => problems.delete(listener);
    }),
    preferences: vi.fn(() => defaultPreferences),
    get: vi.fn<SettingsStore['get']>(() => labels),
    apply: vi.fn<SettingsStore['apply']>(() =>
      Promise.resolve({ok: true, value: {id: 'labels', revision: 2}}),
    ),
    dispose: vi.fn(() => Promise.resolve()),
  };
  const emit = (document: SettingsDocument) => {
    for (const listener of changes) listener(document);
  };
  return {store, changes, problems, emit};
}

describe('settings channels', () => {
  it('sends every changed document, and the normalized preferences after a preferences change', async () => {
    const {store, emit} = mockStore();
    const channels = registerSettingsChannels(
      Promise.resolve(store),
      recordingLogger(),
    );
    onTestFinished(() => channels.dispose());
    await vi.waitFor(() => expect(store.subscribe).toHaveBeenCalledOnce());
    electron.send.mockClear();

    emit(labels);
    expect(electron.send.mock.calls).toEqual([
      [settingsEndpoints.changed.channel, labels],
    ]);
    emit(preferences);
    expect(electron.send).toHaveBeenLastCalledWith(
      settingsEndpoints.preferencesChanged.channel,
      defaultPreferences,
    );
  });

  it('answers a read with the store document and logs and refuses a malformed one', async () => {
    const {store} = mockStore();
    const log = recordingLogger();
    const channels = registerSettingsChannels(Promise.resolve(store), log);
    onTestFinished(() => channels.dispose());

    expect(
      await handler(settingsEndpoints.get.channel)({}, {name: 'labels'}),
    ).toBe(labels);
    await expect(
      handler(settingsEndpoints.get.channel)({}, {name: 'unknown'}),
    ).rejects.toThrow('Invalid settings read');
    expect(log.messages('warn')).toEqual(['dropped a malformed settings read']);
  });

  it('passes a valid edit to the store and logs and refuses a malformed one', async () => {
    const {store} = mockStore();
    const log = recordingLogger();
    const channels = registerSettingsChannels(Promise.resolve(store), log);
    onTestFinished(() => channels.dispose());

    expect(
      await handler(settingsEndpoints.edit.channel)({}, labelsUpdate),
    ).toEqual({ok: true, value: {id: 'labels', revision: 2}});
    expect(store.apply).toHaveBeenCalledOnce();
    expect(
      await handler(settingsEndpoints.edit.channel)(
        {},
        {type: 'settings.update', name: 'labels'},
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.apply).toHaveBeenCalledOnce();
    expect(log.messages('warn')).toEqual(['dropped a malformed settings edit']);
  });

  it('finishes an accepted rename before closing its settings store', async () => {
    const {store} = mockStore();
    let release: (result: EditResult) => void = () => undefined;
    let began: () => void = () => undefined;
    const started = new Promise<void>(resolve => {
      began = resolve;
    });
    const rename = vi.fn(async (): Promise<EditResult> => {
      began();
      return new Promise<EditResult>(resolve => {
        release = resolve;
      });
    });
    const channels = registerSettingsChannels(
      Promise.resolve(store),
      recordingLogger(),
      rename,
    );
    onTestFinished(() => {
      release({ok: true, value: {id: 'labels', revision: 2}});
      return channels.dispose();
    });
    const pending = handler(settingsEndpoints.edit.channel)(
      {},
      {
        type: 'labels.rename',
        name: 'labels',
        from: 'Before',
        to: 'After',
        baseRevision: 1,
      },
    );
    await started;
    const closing = channels.dispose();
    expect(electron.handlers.size).toBe(0);
    expect(store.dispose).not.toHaveBeenCalled();
    release({ok: true, value: {id: 'labels', revision: 2}});
    expect(await pending).toMatchObject({ok: true});
    await closing;
    expect(store.dispose).toHaveBeenCalledOnce();
  });

  it('rejects pending reads and edits after closing and cancels late problem subscriptions', async () => {
    const {store, changes, problems} = mockStore();
    let finish: (value: typeof store) => void = () => undefined;
    const loading = new Promise<typeof store>(resolve => {
      finish = resolve;
    });
    const channels = registerSettingsChannels(loading, recordingLogger());
    onTestFinished(() => {
      finish(store);
      return channels.dispose();
    });
    const read = handler(settingsEndpoints.get.channel)({}, {name: 'labels'});
    const failedRead = expect(read).rejects.toThrow('Settings unavailable');
    const edit = handler(settingsEndpoints.edit.channel)({}, labelsUpdate);
    const listener = vi.fn();
    channels.subscribe(listener)();
    const closing = channels.dispose();
    finish(store);

    await failedRead;
    expect(await edit).toMatchObject({ok: false, error: {reason: 'not-found'}});
    await closing;
    expect(store.apply).not.toHaveBeenCalled();
    expect(changes.size).toBe(0);
    expect(problems.size).toBe(0);
    expect(electron.handlers.size).toBe(0);
  });

  it('logs a rejected load and returns unavailable answers without unhandled subscriptions', async () => {
    const log = recordingLogger();
    const channels = registerSettingsChannels(
      Promise.reject(new Error('Load failed')),
      log,
    );
    onTestFinished(() => channels.dispose());
    await expect(
      handler(settingsEndpoints.get.channel)({}, {name: 'labels'}),
    ).rejects.toThrow('Settings unavailable');
    expect(
      await handler(settingsEndpoints.edit.channel)({}, labelsUpdate),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(log.messages('error')).toContain('could not open settings channels');
  });
});
