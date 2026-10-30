import {describe, expect, it, vi} from 'vitest';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {createSettingsAccess} from './settingsAccess';
import {SettingsStore, type SettingsReader} from './settingsStore';

function setup() {
  const document = expectSuccess(
    parseSettingsDocument({
      name: 'messages',
      value: {
        format: 'llsettings.messages',
        schemaVersion: 1,
        templates: [],
        stagePresets: [],
      },
      access: 'editable',
      revision: 1,
    }),
  );
  const log = recordingLogger();
  const store = new SettingsStore({
    documents: new Map([['messages', document]]),
    problems: [],
    log,
  });
  return {document, store, log};
}

describe('main-side settings access', () => {
  it('waits for loading, reads the current document, and releases change subscriptions', async () => {
    const {store, document, log} = setup();
    let finish: (store: SettingsReader) => void = () => undefined;
    const access = createSettingsAccess(
      new Promise<SettingsReader>(resolve => {
        finish = resolve;
      }),
      log,
    );
    const listener = vi.fn<(document: SettingsDocument) => void>();
    const stop = access.subscribeSettingsChanges(listener);
    const pending = access.readSettings('messages');
    finish(store);
    expect(await pending).toEqual(document);
    expect(store.changeListenerCount).toBe(1);
    stop();
    stop();
    expect(store.changeListenerCount).toBe(0);
    access.subscribeSettingsChanges(listener);
    await Promise.resolve();
    expect(store.changeListenerCount).toBe(1);
    access.dispose();
    access.dispose();
    expect(store.changeListenerCount).toBe(0);
    expect(await access.readSettings('messages')).toBeNull();
    await store.dispose();
  });

  it('cancels subscriptions and reads when closed before loading, including already cancelled listeners', async () => {
    const {store, log} = setup();
    let finish: (store: SettingsReader) => void = () => undefined;
    const access = createSettingsAccess(
      new Promise<SettingsReader>(resolve => {
        finish = resolve;
      }),
      log,
    );
    const listener = vi.fn();
    access.subscribeSettingsChanges(listener)();
    access.subscribeSettingsChanges(listener);
    const pending = access.readSettings('messages');
    access.dispose();
    finish(store);
    expect(await pending).toBeNull();
    await Promise.resolve();
    expect(store.changeListenerCount).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    access.subscribeSettingsChanges(listener);
    await Promise.resolve();
    expect(store.changeListenerCount).toBe(0);
    await store.dispose();
  });

  it('returns null and logs unavailable areas and rejected loading without unhandled subscriptions', async () => {
    const {store, log} = setup();
    const access = createSettingsAccess(Promise.resolve(store), log);
    expect(await access.readSettings('props')).toBeNull();
    expect(log.messages('error')).toContain('could not read a settings area');
    access.dispose();
    const failed = createSettingsAccess(
      Promise.reject(new Error('Load failed')),
      log,
    );
    failed.subscribeSettingsChanges(vi.fn());
    expect(await failed.readSettings('messages')).toBeNull();
    expect(log.messages('error')).toContain(
      'could not open main-side settings access',
    );
    failed.dispose();
    await store.dispose();
  });
});
