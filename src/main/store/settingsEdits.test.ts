import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@core/schema/testHelpers';
import type {DocumentFiles} from './contentPersistence';
import {SettingsStore} from './settingsStore';
import {settingsDocument} from '@core/testing/settingsDocument';
import type {WriteResult} from './fileWriter';

const value = {format: 'llsettings.labels', schemaVersion: 1, labels: []};

function setup(
  access: 'editable' | 'readOnly' = 'editable',
  extra: readonly SettingsDocument[] = [],
) {
  vi.useFakeTimers();
  const write = vi
    .fn<DocumentFiles['write']>()
    .mockResolvedValue({ok: true, value: undefined});
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
  const current = expectSuccess(
    parseSettingsDocument({name: 'labels', value, revision: 1, access}),
  );
  const store = new SettingsStore({
    documents: new Map([
      ['labels', current],
      ...extra.map(document => [document.name, document] as const),
    ]),
    problems: [],
    log,
    saving: {
      folder: '/settings',
      files: {write, remove: async () => ({ok: true, value: undefined})},
    },
  });
  onTestFinished(async () => {
    await store.dispose();
    vi.useRealTimers();
  });
  return {store, write, log};
}

function edit(label: string, baseRevision: number) {
  return expectSuccess(
    parseSettingsEdit({
      type: 'settings.update',
      name: 'labels',
      baseRevision,
      value: {...value, labels: [{name: label, color: 'teal', key: null}]},
    }),
  );
}

describe('settings edits and saves', () => {
  it('broadcasts and persists shortcut removal in the same object deletion batch', async () => {
    const id = '44000000-0000-4000-8000-000000000001';
    const macros = settingsDocument('macros', {
      macros: [{id, name: '점검', icon: 'macro', color: 'teal', actions: []}],
      collections: [],
    });
    const shortcuts = settingsDocument('shortcuts', {
      bindings: {
        [`macro.${id}`]: [{code: 'F8', mods: []}],
        'future.command': [],
      },
    });
    const {store, write} = setup('editable', [macros, shortcuts]);
    const changed = vi.fn<(document: SettingsDocument) => void>();
    store.subscribe(changed);
    const edit = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'macros',
        baseRevision: 1,
        value: {...macros.value, macros: []},
      }),
    );
    const result = store.apply(edit);
    expect(changed.mock.calls.map(([document]) => document.name)).toEqual([
      'macros',
      'shortcuts',
    ]);
    expect(store.get('shortcuts')).toMatchObject({
      revision: 2,
      value: {bindings: {'future.command': []}},
    });
    await vi.advanceTimersByTimeAsync(500);
    expect((await result).ok).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(
      write.mock.calls.some(
        ([request]) =>
          request.text.includes('future.command') &&
          !request.text.includes(`macro.${id}`),
      ),
    ).toBe(true);
  });
  it('persists the latest burst while an earlier write is held', async () => {
    const {store, write} = setup();
    let release: (value: WriteResult) => void = () => undefined;
    write.mockReturnValueOnce(
      new Promise<WriteResult>(resolve => {
        release = resolve;
      }),
    );
    try {
      const first = store.apply(edit('First', 1));
      await vi.advanceTimersByTimeAsync(500);
      const second = store.apply(edit('Superseded', 2));
      await vi.advanceTimersByTimeAsync(500);
      const third = store.apply(edit('Latest', 3));
      release({ok: true, value: undefined});
      await vi.advanceTimersByTimeAsync(0);
      await Promise.all([first, second, third]);
      await vi.advanceTimersByTimeAsync(500);
      expect(write).toHaveBeenCalledTimes(2);
      expect(write.mock.calls[1]?.[0].text).toContain('Latest');
      expect(write.mock.calls[1]?.[0].text).not.toContain('Superseded');
    } finally {
      release({ok: true, value: undefined});
    }
  });

  it('broadcasts before disk work, debounces a burst, and refuses an older revision', async () => {
    const {store, write} = setup();
    const listener = vi.fn<(document: SettingsDocument) => void>();
    const stop = store.subscribe(listener);
    const first = store.apply(edit('First', 1));
    expect(store.get('labels').revision).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    const second = store.apply(edit('Second', 2));
    expect(await store.apply(edit('Stale', 1))).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0].text).toContain('Second');
    expect(await first).toEqual({ok: true, value: {id: 'labels', revision: 2}});
    expect(await second).toEqual({
      ok: true,
      value: {id: 'labels', revision: 3},
    });
    expect(listener.mock.calls.map(([document]) => document.revision)).toEqual([
      2, 3,
    ]);
    stop();
    expect(store.changeListenerCount).toBe(0);
  });

  it('refuses read-only files and schema-version changes without changes or writes', async () => {
    const {store, write} = setup('readOnly');
    expect(await store.apply(edit('Blocked', 1))).toMatchObject({
      ok: false,
      error: {reason: 'read-only'},
    });
    expect(store.get('labels').revision).toBe(1);
    expect(write).not.toHaveBeenCalled();
    const editable = setup();
    const wrongVersion = expectSuccess(
      parseSettingsEdit({
        ...edit('Wrong version', 1),
        value: {...value, schemaVersion: 2},
      }),
    );
    expect(await editable.store.apply(wrongVersion)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(editable.write).not.toHaveBeenCalled();
  });

  it('returns an applied write failure, keeps the revision, and retries the latest content on flush', async () => {
    const {store, write} = setup();
    const file = join('/settings', 'labels.json');
    write.mockResolvedValueOnce({
      ok: false,
      error: {file, message: 'Disk unavailable'},
    });
    const pending = store.apply(edit('Kept', 1));
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toEqual({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk unavailable',
        applied: {id: 'labels', revision: 2},
        unchangedFiles: [file],
      },
    });
    expect(store.get('labels')).toMatchObject({
      revision: 2,
      value: {labels: [{name: 'Kept'}]},
    });
    await store.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[0].text).toContain('Kept');
  });

  it('isolates failed subscribers and flushes accepted edits when closed', async () => {
    const {store, write, log} = setup();
    store.subscribe(() => {
      throw new Error('Listener failed');
    });
    const listener = vi.fn();
    store.subscribe(listener);
    const pending = store.apply(edit('Saved on close', 1));
    expect(listener).toHaveBeenCalledOnce();
    expect(log.error).toHaveBeenCalledWith(
      'settings change listener failed',
      expect.any(Error),
    );
    await store.dispose();
    expect(await pending).toMatchObject({ok: true});
    expect(write).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(store.changeListenerCount).toBe(0);
    expect(await store.apply(edit('Late', 2))).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    const late = vi.fn();
    store.subscribe(late);
    expect(late).not.toHaveBeenCalled();
  });
});
