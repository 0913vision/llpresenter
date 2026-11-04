import {describe, expect, it, vi} from 'vitest';
import type {
  SettingsListener,
  SettingsReader,
} from '@core/schema/settingsReader';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {createSettingsAccess} from '@main/store/settingsAccess';

const document = expectSuccess(
  parseSettingsDocument({
    name: 'messages',
    value: {
      format: 'llsettings.messages',
      schemaVersion: 1,
      templates: [],
    },
    access: 'editable',
    revision: 1,
  }),
);

function mockReader() {
  const listeners = new Set<SettingsListener>();
  const reader: SettingsReader = {
    get: vi.fn<SettingsReader['get']>(name => {
      if (name !== 'messages') throw new Error(`No ${name} settings`);
      return document;
    }),
    preferences: vi.fn(),
    subscribe: vi.fn<SettingsReader['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const emit = () => {
    for (const listener of listeners) listener(document);
  };
  return {reader, listeners, emit};
}

function pendingReader() {
  let finish: (reader: SettingsReader) => void = () => undefined;
  const loading = new Promise<SettingsReader>(resolve => {
    finish = resolve;
  });
  return {loading, finish: (reader: SettingsReader) => finish(reader)};
}

describe('main-side settings access', () => {
  it('waits for loading, reads the current document, and releases change subscriptions', async () => {
    const {reader, listeners, emit} = mockReader();
    const {loading, finish} = pendingReader();
    const access = createSettingsAccess(loading, recordingLogger());
    const listener = vi.fn<(document: SettingsDocument) => void>();
    const stop = access.subscribeSettingsChanges(listener);
    const pending = access.readSettings('messages');
    finish(reader);

    expect(await pending).toBe(document);
    expect(listeners.size).toBe(1);
    emit();
    expect(listener).toHaveBeenCalledExactlyOnceWith(document);
    stop();
    stop();
    expect(listeners.size).toBe(0);
    access.subscribeSettingsChanges(listener);
    await Promise.resolve();
    expect(listeners.size).toBe(1);
    access.dispose();
    access.dispose();
    expect(listeners.size).toBe(0);
    expect(await access.readSettings('messages')).toBeNull();
  });

  it('cancels subscriptions and reads when closed before loading, including already cancelled listeners', async () => {
    const {reader, listeners} = mockReader();
    const {loading, finish} = pendingReader();
    const access = createSettingsAccess(loading, recordingLogger());
    const listener = vi.fn();
    access.subscribeSettingsChanges(listener)();
    access.subscribeSettingsChanges(listener);
    const pending = access.readSettings('messages');
    access.dispose();
    finish(reader);

    expect(await pending).toBeNull();
    await Promise.resolve();
    expect(listeners.size).toBe(0);
    access.subscribeSettingsChanges(listener);
    await Promise.resolve();
    expect(listeners.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns null and logs unavailable areas and rejected loading without unhandled subscriptions', async () => {
    const {reader} = mockReader();
    const log = recordingLogger();
    const access = createSettingsAccess(Promise.resolve(reader), log);
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
  });
});
