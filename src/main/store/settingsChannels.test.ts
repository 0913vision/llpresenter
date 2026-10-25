import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {recordingLogger} from '../displays/testing';
import {registerSettingsChannels} from './settingsChannels';
import {SettingsStore} from './settingsStore';
import type {EditResult} from '@shared/schema/contentEdit';

type Handler = (event: unknown, value: unknown) => unknown;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({
  BrowserWindow: {getAllWindows: () => []},
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

function handler(channel: string): Handler {
  const found = handlers.get(channel);
  if (found === undefined) throw new Error(`Missing handler ${channel}`);
  return found;
}

describe('settings channel lifetime', () => {
  it('finishes an accepted rename before closing its settings store', async () => {
    const log = recordingLogger();
    const store = new SettingsStore({documents: new Map(), problems: [], log});
    const dispose = vi.spyOn(store, 'dispose');
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
      log,
      rename,
    );
    onTestFinished(() => {
      release({ok: true, value: {id: 'labels', revision: 2}});
      return channels.dispose();
    });
    const pending = handler(Channels.settingsEdit)(
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
    expect(handlers.size).toBe(0);
    expect(dispose).not.toHaveBeenCalled();
    release({ok: true, value: {id: 'labels', revision: 2}});
    expect(await pending).toMatchObject({ok: true});
    await closing;
    expect(dispose).toHaveBeenCalledOnce();
  });
  it('rejects pending reads and edits after closing and cancels late problem subscriptions', async () => {
    const log = recordingLogger();
    const store = new SettingsStore({documents: new Map(), problems: [], log});
    const apply = vi.spyOn(store, 'apply');
    let finish: (value: SettingsStore) => void = () => undefined;
    const loading = new Promise<SettingsStore>(resolve => {
      finish = resolve;
    });
    const channels = registerSettingsChannels(loading, log);
    onTestFinished(() => {
      finish(store);
      return channels.dispose();
    });
    const read = handler(Channels.settingsGet)({}, {name: 'labels'});
    const failedRead = expect(read).rejects.toThrow('Settings unavailable');
    const edit = handler(Channels.settingsEdit)(
      {},
      {
        type: 'settings.update',
        name: 'labels',
        value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
        baseRevision: 1,
      },
    );
    const listener = vi.fn();
    channels.subscribe(listener)();
    const closing = channels.dispose();
    finish(store);
    await failedRead;
    expect(await edit).toMatchObject({ok: false, error: {reason: 'not-found'}});
    await closing;
    expect(apply).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(store.listenerCount).toBe(0);
    expect(store.changeListenerCount).toBe(0);
    expect(handlers.size).toBe(0);
  });

  it('logs a rejected load and returns unavailable answers without unhandled subscriptions', async () => {
    const log = recordingLogger();
    const channels = registerSettingsChannels(
      Promise.reject(new Error('Load failed')),
      log,
    );
    onTestFinished(() => channels.dispose());
    await expect(
      handler(Channels.settingsGet)({}, {name: 'labels'}),
    ).rejects.toThrow('Settings unavailable');
    expect(
      await handler(Channels.settingsEdit)(
        {},
        {
          type: 'settings.update',
          name: 'labels',
          value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
          baseRevision: 1,
        },
      ),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(log.messages('error')).toContain('could not open settings channels');
  });
});
