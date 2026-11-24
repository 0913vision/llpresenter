import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import type {DocumentFiles} from '@main/store/content/contentPersistence';
import {SettingsStore} from '@main/store/settings/settingsStore';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {WriteResult} from '@main/store/files/fileWriter';

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
      value: {...value, labels: [{name: label, color: '#5FB8C2', key: null}]},
    }),
  );
}

describe('settings edits and saves', () => {
  it('undoes and redoes a settings deletion with its removed shortcuts', async () => {
    const id = '44000000-0000-4000-8000-000000000001';
    const macros = settingsDocument('macros', {
      macros: [{id, name: '점검', icon: 'macro', color: 'teal', actions: []}],
      collections: [],
    });
    const shortcuts = settingsDocument('shortcuts', {
      bindings: {[`macro.${id}`]: [{code: 'F8', mods: []}]},
    });
    const {store} = setup('editable', [macros, shortcuts]);
    const remove = expectSuccess(
      parseSettingsEdit({
        type: 'settings.update',
        name: 'macros',
        baseRevision: 1,
        value: {...macros.value, macros: []},
      }),
    );
    const deleted = store.apply(remove);
    await vi.advanceTimersByTimeAsync(500);
    expect((await deleted).ok).toBe(true);
    const undo = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.undoDelete',
          name: 'delete-history',
          area: 'macros',
          expectedRevision: 2,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await undo).ok).toBe(true);
    expect(store.get('macros').value).toEqual(macros.value);
    expect(store.get('shortcuts').value).toEqual(shortcuts.value);
    const redo = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.redoDelete',
          name: 'delete-history',
          area: 'macros',
          expectedRevision: 2,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await redo).ok).toBe(true);
    expect(store.get('macros').value).toMatchObject({macros: []});
  });

  it('restores a deleted timer, its quick item, and its shortcuts together', async () => {
    const timerId = '44000000-0000-4000-8000-000000000011';
    const quickId = '44000000-0000-4000-8000-000000000012';
    const timers = settingsDocument('timers', {
      timers: [{id: timerId, name: 'Clock', kind: 'clock'}],
    });
    const quick = settingsDocument('quick', {
      items: [{id: quickId, kind: 'timer', name: 'Clock', ref: timerId}],
    });
    const shortcuts = settingsDocument('shortcuts', {
      bindings: {
        [`timer.${timerId}.toggle`]: [{code: 'F8', mods: []}],
        [`quick.${quickId}`]: [{code: 'F9', mods: []}],
      },
    });
    const {store} = setup('editable', [timers, quick, shortcuts]);
    const deleted = store.apply(
      expectSuccess(
        parseSettingsEdit({type: 'timer.delete', name: 'timers', timerId}),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await deleted).ok).toBe(true);
    const undo = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.undoDelete',
          name: 'delete-history',
          area: 'timers',
          expectedRevision: 2,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await undo).ok).toBe(true);
    expect(store.get('timers').value).toEqual(timers.value);
    expect(store.get('quick').value).toEqual(quick.value);
    expect(store.get('shortcuts').value).toEqual(shortcuts.value);
  });

  it('restores actions removed from a macro as one deletion', async () => {
    const macros = settingsDocument('macros', {
      macros: [
        {
          id: '44000000-0000-4000-8000-000000000001',
          name: 'Macro',
          icon: 'macro',
          color: 'teal',
          actions: [{kind: 'clearAll'}, {kind: 'clearAll'}],
        },
      ],
      collections: [],
    });
    if (macros.name !== 'macros') throw new Error('Missing macro settings');
    const {store} = setup('editable', [macros]);
    const removed = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 1,
          value: {
            ...macros.value,
            macros: macros.value.macros.map(macro => ({...macro, actions: []})),
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await removed).ok).toBe(true);
    const undo = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.undoDelete',
          name: 'delete-history',
          area: 'macros',
          expectedRevision: 2,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await undo).ok).toBe(true);
    expect(store.get('macros').value).toEqual(macros.value);
  });

  it('does not undo another window’s later deletion', async () => {
    const macros = settingsDocument('macros', {
      macros: [
        {
          id: '44000000-0000-4000-8000-000000000001',
          name: 'One',
          icon: 'macro',
          color: 'teal',
          actions: [],
        },
        {
          id: '44000000-0000-4000-8000-000000000002',
          name: 'Two',
          icon: 'macro',
          color: 'teal',
          actions: [],
        },
      ],
      collections: [],
    });
    if (macros.name !== 'macros') throw new Error('Missing macro settings');
    const {store} = setup('editable', [macros]);
    const first = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 1,
          value: {...macros.value, macros: macros.value.macros.slice(1)},
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await first).ok).toBe(true);
    const second = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 2,
          value: {...macros.value, macros: []},
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await second).ok).toBe(true);
    expect(
      await store.apply(
        expectSuccess(
          parseSettingsEdit({
            type: 'settings.undoDelete',
            name: 'delete-history',
            area: 'macros',
            expectedRevision: 2,
          }),
        ),
      ),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(store.get('macros').value).toMatchObject({macros: []});
  });

  it('restores a deleted row while preserving a later settings edit', async () => {
    const id = '44000000-0000-4000-8000-000000000001';
    const macros = settingsDocument('macros', {
      macros: [{id, name: '점검', icon: 'macro', color: 'teal', actions: []}],
      collections: [],
    });
    const {store} = setup('editable', [macros]);
    const deleted = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 1,
          value: {...macros.value, macros: []},
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await deleted).ok).toBe(true);
    const later = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 2,
          value: {
            ...macros.value,
            macros: [],
            collections: [
              {
                id: '44000000-0000-4000-8000-000000000002',
                name: 'Later',
                macroIds: [],
              },
            ],
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await later).ok).toBe(true);
    const undo = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.undoDelete',
          name: 'delete-history',
          area: 'macros',
          expectedRevision: 2,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await undo).ok).toBe(true);
    expect(store.get('macros').value).toMatchObject({
      macros: [{id}],
      collections: [{name: 'Later'}],
    });
  });

  it('undoes consecutive deletions after an unrelated row was edited', async () => {
    const macros = settingsDocument('macros', {
      macros: [
        {
          id: '44000000-0000-4000-8000-000000000001',
          name: 'A',
          icon: 'macro',
          color: 'teal',
          actions: [],
        },
        {
          id: '44000000-0000-4000-8000-000000000002',
          name: 'B',
          icon: 'macro',
          color: 'teal',
          actions: [],
        },
        {
          id: '44000000-0000-4000-8000-000000000003',
          name: 'C',
          icon: 'macro',
          color: 'teal',
          actions: [],
        },
      ],
      collections: [],
    });
    if (macros.name !== 'macros') throw new Error('Missing macros');
    const {store} = setup('editable', [macros]);
    for (const [revision, rows] of [
      [1, macros.value.macros.slice(1)],
      [2, macros.value.macros.slice(2)],
    ] as const) {
      const edit = store.apply(
        expectSuccess(
          parseSettingsEdit({
            type: 'settings.update',
            name: 'macros',
            baseRevision: revision,
            value: {...macros.value, macros: rows},
          }),
        ),
      );
      await vi.advanceTimersByTimeAsync(500);
      expect((await edit).ok).toBe(true);
    }
    const later = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 3,
          value: {
            ...macros.value,
            macros: [{...macros.value.macros[2], name: 'Changed C'}],
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await later).ok).toBe(true);
    for (const expectedRevision of [3, 2]) {
      const undo = store.apply(
        expectSuccess(
          parseSettingsEdit({
            type: 'settings.undoDelete',
            name: 'delete-history',
            area: 'macros',
            expectedRevision,
          }),
        ),
      );
      await vi.advanceTimersByTimeAsync(500);
      expect((await undo).ok).toBe(true);
    }
    expect(store.get('macros').value).toMatchObject({
      macros: [{name: 'A'}, {name: 'B'}, {name: 'Changed C'}],
    });
  });

  it('restores references and shortcuts while preserving later changes', async () => {
    const id = '44000000-0000-4000-8000-000000000001';
    const other = '44000000-0000-4000-8000-000000000002';
    const group = '44000000-0000-4000-8000-000000000003';
    const macros = settingsDocument('macros', {
      macros: [
        {id, name: 'Removed', icon: 'macro', color: 'teal', actions: []},
        {id: other, name: 'Other', icon: 'macro', color: 'teal', actions: []},
      ],
      collections: [{id: group, name: 'Group', macroIds: [id, other]}],
    });
    const shortcuts = settingsDocument('shortcuts', {
      bindings: {
        [`macro.${id}`]: [{code: 'F8', mods: []}],
        'future.command': [],
      },
    });
    if (macros.name !== 'macros' || shortcuts.name !== 'shortcuts') {
      throw new Error('Missing settings');
    }
    const {store} = setup('editable', [macros, shortcuts]);
    const deleted = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'macros',
          baseRevision: 1,
          value: {
            ...macros.value,
            macros: macros.value.macros.slice(1),
            collections: [{...macros.value.collections[0], macroIds: [other]}],
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await deleted).ok).toBe(true);
    const current = store.get('shortcuts');
    if (current.name !== 'shortcuts') throw new Error('Missing shortcuts');
    const changed = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.update',
          name: 'shortcuts',
          baseRevision: current.revision,
          value: {
            ...current.value,
            bindings: {
              ...current.value.bindings,
              'future.command': [{code: 'F9', mods: []}],
            },
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await changed).ok).toBe(true);
    const undo = store.apply(
      expectSuccess(
        parseSettingsEdit({
          type: 'settings.undoDelete',
          name: 'delete-history',
          area: 'macros',
          expectedRevision: 2,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect((await undo).ok).toBe(true);
    expect(store.get('macros').value).toMatchObject({
      collections: [{macroIds: [id, other]}],
    });
    expect(store.get('shortcuts').value).toMatchObject({
      bindings: {
        [`macro.${id}`]: [{code: 'F8'}],
        'future.command': [{code: 'F9'}],
      },
    });
  });
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

  it('broadcasts before saving labels immediately and refuses an older revision', async () => {
    const {store, write} = setup();
    const listener = vi.fn<(document: SettingsDocument) => void>();
    const stop = store.subscribe(listener);
    const first = store.apply(edit('First', 1));
    expect(store.get('labels').revision).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    const second = store.apply(edit('Second', 2));
    expect(await store.apply(edit('Stale', 1))).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(await first).toEqual({ok: true, value: {id: 'labels', revision: 2}});
    expect(await second).toEqual({
      ok: true,
      value: {id: 'labels', revision: 3},
    });
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0].text).toContain('Second');
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

describe('edits that change two settings files', () => {
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const timers = expectSuccess(
    parseSettingsDocument({
      name: 'timers',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.timers',
        schemaVersion: 1,
        timers: [{id: id(1), name: '기존', kind: 'clock'}],
      },
    }),
  );
  const quick = expectSuccess(
    parseSettingsDocument({
      name: 'quick',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.quick',
        schemaVersion: 1,
        items: [{id: id(11), kind: 'timer', ref: id(1), name: '기존'}],
      },
    }),
  );
  const rename = expectSuccess(
    parseSettingsEdit({
      type: 'timer.rename',
      name: 'timers',
      timerId: id(1),
      timerName: '설교',
    }),
  );
  const names = (store: SettingsStore) => {
    const t = store.get('timers');
    const q = store.get('quick');
    if (t.name !== 'timers' || q.name !== 'quick') throw new Error('Missing');
    return [t.value.timers[0]?.name, q.value.items[0]?.name];
  };

  it('applies both files before telling any listener', async () => {
    const {store, write} = setup('editable', [timers, quick]);
    const seen: unknown[] = [];
    store.subscribe(() => seen.push(names(store)));

    const pending = store.apply(rename);
    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toMatchObject({ok: true});
    expect(seen).toEqual([
      ['설교', '설교'],
      ['설교', '설교'],
    ]);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('keeps both files applied after a failed save and retries them on an edit that changes nothing', async () => {
    const {store, write} = setup('editable', [timers, quick]);
    write.mockImplementation(async request => ({
      ok: false,
      error: {file: request.target.file, message: 'Invented disk failure'},
    }));
    const first = store.apply(rename);
    await vi.advanceTimersByTimeAsync(500);
    expect(await first).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', applied: {id: id(1)}},
    });
    expect(names(store)).toEqual(['설교', '설교']);
    const writes = write.mock.calls.length;

    write.mockResolvedValue({ok: true, value: undefined});
    const retry = store.apply(rename);
    await vi.advanceTimersByTimeAsync(500);
    expect(await retry).toMatchObject({ok: true});
    expect(write.mock.calls.length).toBe(writes + 2);
  });
});
