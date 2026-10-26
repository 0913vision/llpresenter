import {describe, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';
import type {
  ServiceDocument,
  SongDocument,
} from '@shared/schema/contentDocuments';
import {
  parseServiceDocument,
  parseSongDocument,
} from '@shared/schema/contentDocuments';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from './pendingWrites';
import {ServiceOrderEdits} from './serviceOrderEdits';

const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const otherId = createServiceId('00000000-0000-4000-8000-000000000002');
const songId = createSongId('10000000-0000-4000-8000-000000000001');
const [first, second, third] = [1, 2, 3].map(number =>
  createServiceItemId(
    `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  ),
);
if (first === undefined || second === undefined || third === undefined) {
  throw new Error('Missing item ids');
}

function fixture() {
  const parsed = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: 'Invented service',
      date: '2026-10-26T09:00',
      futureMetadata: {keep: true},
      order: [
        {id: first, header: 'Invented header'},
        {id: second, song: songId, memo: 'Keep this', futureField: [1, 2]},
        {id: third, futureKind: {keep: true}},
      ],
    },
    revision: 1,
    access: 'editable',
  });
  const parsedSong = parseSongDocument({
    song: {
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: 'Invented song',
      slides: [{lines: ['Invented words']}],
    },
    revision: 1,
    access: 'editable',
  });
  if (
    !parsed.ok ||
    parsed.value === null ||
    !parsedSong.ok ||
    parsedSong.value === null
  ) {
    throw new Error('Invalid service edit fixture');
  }
  const state: {document: ServiceDocument | null; song: SongDocument | null} = {
    document: parsed.value,
    song: parsedSong.value,
  };
  const send = vi.fn();
  const edit = vi.fn((command: ContentEdit): Promise<EditResult> => {
    if (command.type !== 'service.update' || state.document === null) {
      throw new Error('Unexpected edit');
    }
    if (command.baseRevision !== state.document.revision) {
      return Promise.resolve({
        ok: false,
        error: {reason: 'stale', message: 'Changed'},
      });
    }
    state.document = {
      ...state.document,
      service: command.service,
      revision: state.document.revision + 1,
    };
    return Promise.resolve({
      ok: true,
      value: {id: serviceId, revision: state.document.revision},
    });
  });
  const api = fakeLlpApi({
    live: {send},
    services: {get: () => Promise.resolve(state.document)},
    songs: {get: () => Promise.resolve(state.song)},
    content: {edit},
  });
  return {
    state,
    api,
    edit,
    send,
    edits: new ServiceOrderEdits(api),
    ids: () => state.document?.service.order.map(item => item.id),
  };
}

describe('service order edits', () => {
  it('runs through the window pending writes and refuses edits once they stop', async () => {
    const {api, edits, edit} = fixture();
    const writes = pendingWritesOf(api);
    const moving = edits.move(serviceId, third, first);
    const flushing = writes.flush();
    expect(await moving).toEqual({ok: true, value: true});
    expect(await flushing).toBe(true);
    expect(await edits.move(serviceId, first, third)).toMatchObject({
      ok: false,
      error: {reason: 'busy'},
    });
    expect(edit).toHaveBeenCalledOnce();
    writes.resume();
  });

  it('moves songs and unknown rows without changing outputs', async () => {
    const {edits, ids, send, edit} = fixture();
    expect(await edits.move(serviceId, third, first)).toEqual({
      ok: true,
      value: true,
    });
    expect(ids()).toEqual([third, first, second]);
    await edits.move(serviceId, second, first);
    expect(ids()).toEqual([third, second, first]);
    await edits.move(serviceId, second, third);
    expect(ids()).toEqual([second, third, first]);
    expect(edit.mock.calls.map(([command]) => command.type)).toEqual([
      'service.update',
      'service.update',
      'service.update',
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it('moves a header with all rows until the next header and undoes the section move', async () => {
    const {state, edits, ids, send, edit} = fixture();
    if (state.document === null) throw new Error('Missing document');
    const tail = createServiceItemId('20000000-0000-4000-8000-000000000004');
    const order = [
      state.document.service.order[0],
      state.document.service.order[1],
      {id: third, header: 'Second section'},
      {id: tail, song: songId},
    ];
    if (order[0] === undefined || order[1] === undefined) {
      throw new Error('Missing rows');
    }
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: order.filter(item => item !== undefined),
      },
    };
    expect(await edits.move(serviceId, first, second)).toEqual({
      ok: true,
      value: false,
    });
    expect(edit).not.toHaveBeenCalled();
    await edits.move(serviceId, first, null);
    expect(ids()).toEqual([third, tail, first, second]);
    await edits.undo(serviceId);
    expect(ids()).toEqual([first, second, third, tail]);
    await edits.move(serviceId, first, tail);
    expect(ids()).toEqual([first, second, third, tail]);
    await edits.move(serviceId, third, second);
    expect(ids()).toEqual([third, tail, first, second]);
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes immediately and supports edit undo and redo, preserving unknown data', async () => {
    const {state, edits, ids, send} = fixture();
    const original = state.document;
    await edits.remove(serviceId, second);
    expect(ids()).toEqual([first, third]);
    expect(edits.canUndo(serviceId)).toBe(true);
    await edits.undo(serviceId);
    expect(state.document?.service).toEqual(original?.service);
    expect(edits.canRedo(serviceId)).toBe(true);
    await edits.redo(serviceId);
    expect(ids()).toEqual([first, third]);
    expect(send).not.toHaveBeenCalled();
  });

  it('inserts separate song references with generated ids and inherited defaults', async () => {
    const {state, edits, ids} = fixture();
    await edits.insertSong(serviceId, songId, second);
    await edits.insertSong(serviceId, songId, null);
    const order = state.document?.service.order ?? [];
    expect(order[1]).toEqual({id: order[1]?.id, song: songId});
    expect(order.at(-1)).toEqual({id: order.at(-1)?.id, song: songId});
    expect(new Set(ids()).size).toBe(5);
    await edits.undo(serviceId);
    expect(ids()).toHaveLength(4);
  });

  it('inserts a ready-made item before another, or at the end, and undoes it', async () => {
    const {state, edits, ids} = fixture();
    const header = {
      id: createServiceItemId('90000000-0000-4000-8000-000000000001'),
      header: '머리글',
    };
    const slot = {
      id: createServiceItemId('90000000-0000-4000-8000-000000000002'),
      slot: 'song' as const,
      title: '찬양',
    };
    await edits.insertItem(serviceId, header, second);
    await edits.insertItem(serviceId, slot, null);
    const order = state.document?.service.order ?? [];
    expect(order[1]).toEqual(header);
    expect(order.at(-1)).toEqual(slot);
    expect(ids()).toHaveLength(5);
    await edits.undo(serviceId);
    expect(ids()).toHaveLength(4);
    expect(
      await edits.insertItem(
        serviceId,
        slot,
        createServiceItemId('90000000-0000-4000-8000-0000000000ff'),
      ),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
  });

  it('fills a song slot in place and refuses other slots and songs that are gone', async () => {
    const {state, edits, edit} = fixture();
    const slotId = createServiceItemId('90000000-0000-4000-8000-0000000000a1');
    const bibleSlot = createServiceItemId(
      '90000000-0000-4000-8000-0000000000a2',
    );
    const spareSlot = createServiceItemId(
      '90000000-0000-4000-8000-0000000000a3',
    );
    await edits.insertItem(
      serviceId,
      {id: slotId, slot: 'song', title: '찬양'},
      second,
    );
    await edits.insertItem(
      serviceId,
      {id: spareSlot, slot: 'song', title: '헌금'},
      null,
    );
    await edits.insertItem(
      serviceId,
      {id: bibleSlot, slot: 'bible', title: '성경 구절'},
      null,
    );
    const before = state.document?.service.order.length ?? 0;
    expect(await edits.fillSlotWithSong(serviceId, slotId, songId)).toEqual({
      ok: true,
      value: true,
    });
    const order = state.document?.service.order ?? [];
    expect(order).toHaveLength(before);
    expect(order[1]).toEqual({id: slotId, song: songId});
    expect(order.at(-1)).toMatchObject({slot: 'bible'});
    const calls = edit.mock.calls.length;
    expect(
      await edits.fillSlotWithSong(serviceId, bibleSlot, songId),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await edits.fillSlotWithSong(serviceId, second, songId),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    state.song = null;
    expect(
      await edits.fillSlotWithSong(serviceId, spareSlot, songId),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(edit.mock.calls).toHaveLength(calls);
    await edits.undo(serviceId);
    expect(state.document?.service.order[1]).toMatchObject({slot: 'song'});
  });

  it('renames a header, keeps unknown fields, and ignores a blank name', async () => {
    const {state, edits, edit} = fixture();
    const headerId = state.document?.service.order.find(
      row => 'header' in row,
    )?.id;
    if (headerId === undefined) throw new Error('No header in the fixture');
    await edits.renameHeader(serviceId, headerId, '  말씀  ');
    const renamed = state.document?.service.order.find(
      row => row.id === headerId,
    );
    expect(renamed).toMatchObject({header: '말씀'});
    const calls = edit.mock.calls.length;
    expect(await edits.renameHeader(serviceId, headerId, '   ')).toEqual({
      ok: true,
      value: false,
    });
    expect(edit.mock.calls).toHaveLength(calls);
    await edits.undo(serviceId);
    expect(
      state.document?.service.order.find(row => row.id === headerId),
    ).not.toMatchObject({header: '말씀'});
    expect(await edits.renameHeader(serviceId, second, '다른')).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
  });

  it('reads fresh revisions and keeps metadata changed since the edit on undo', async () => {
    const {state, edits, edit} = fixture();
    await edits.remove(serviceId, second);
    if (state.document === null) throw new Error('Missing document');
    state.document = {
      ...state.document,
      revision: 8,
      service: {...state.document.service, name: 'Updated name'},
    };
    await edits.undo(serviceId);
    expect(edit.mock.calls.at(-1)?.[0]).toMatchObject({
      baseRevision: 8,
      service: {name: 'Updated name'},
    });
  });

  it('does not replace an independently changed order during undo', async () => {
    const {state, edits, edit} = fixture();
    await edits.remove(serviceId, second);
    if (state.document === null) throw new Error('Missing document');
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: [...state.document.service.order].reverse(),
      },
    };
    expect(await edits.undo(serviceId)).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edits.canUndo(serviceId)).toBe(true);
  });

  it('ignores object key order but refuses a later change to an item field', async () => {
    const {state, edits, ids} = fixture();
    await edits.move(serviceId, second, null);
    if (state.document === null) throw new Error('Missing document');
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: state.document.service.order.map(item =>
          item.id === second
            ? {futureField: [1, 2], memo: 'Keep this', song: songId, id: second}
            : item,
        ),
      },
    };
    expect(await edits.undo(serviceId)).toEqual({ok: true, value: true});
    expect(ids()).toEqual([first, second, third]);
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: state.document.service.order.map(item =>
          item.id === second ? {...item, memo: 'Changed independently'} : item,
        ),
      },
    };
    expect(await edits.redo(serviceId)).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
  });

  it('does not replace an independently changed order during redo', async () => {
    const {state, edits, edit} = fixture();
    await edits.remove(serviceId, second);
    await edits.undo(serviceId);
    if (state.document === null) throw new Error('Missing document');
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: state.document.service.order.slice(1),
      },
    };
    expect(await edits.redo(serviceId)).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
    expect(edit).toHaveBeenCalledTimes(2);
  });

  it('ignores no-op moves and empty history, and clears redo only after a new edit', async () => {
    const {edits, edit} = fixture();
    expect(await edits.undo(serviceId)).toEqual({ok: true, value: false});
    await edits.move(serviceId, first, first);
    await edits.move(serviceId, first, second);
    await edits.move(serviceId, third, null);
    expect(edit).not.toHaveBeenCalled();
    await edits.remove(serviceId, second);
    await edits.undo(serviceId);
    await edits.move(serviceId, first, second);
    expect(edits.canRedo(serviceId)).toBe(true);
    await edits.move(serviceId, third, first);
    expect(edits.canRedo(serviceId)).toBe(false);
  });

  it('refuses missing rows, missing drop targets, and removed library songs', async () => {
    const {state, edits, edit} = fixture();
    await edits.remove(serviceId, second);
    edit.mockClear();
    expect(await edits.remove(serviceId, second)).toMatchObject({ok: false});
    expect(await edits.move(serviceId, second, first)).toMatchObject({
      ok: false,
    });
    expect(await edits.move(serviceId, first, second)).toMatchObject({
      ok: false,
    });
    expect(await edits.insertSong(serviceId, songId, second)).toMatchObject({
      ok: false,
    });
    state.song = null;
    expect(await edits.insertSong(serviceId, songId, null)).toMatchObject({
      ok: false,
    });
    expect(edit).not.toHaveBeenCalled();
  });

  it('refuses read-only, removed, and mismatched service documents', async () => {
    const {state, edits, edit} = fixture();
    if (state.document === null) throw new Error('Missing document');
    state.document = {...state.document, access: 'readOnly'};
    expect(await edits.remove(serviceId, first)).toMatchObject({
      ok: false,
      error: {reason: 'read-only'},
    });
    state.document = {
      ...state.document,
      service: {...state.document.service, id: otherId},
    };
    expect(await edits.remove(serviceId, first)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    state.document = null;
    expect(await edits.remove(serviceId, first)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(edit).not.toHaveBeenCalled();
  });

  it('keeps history unchanged after a main-process refusal', async () => {
    const {edits, edit} = fixture();
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    expect(await edits.remove(serviceId, first)).toMatchObject({ok: false});
    expect(edits.canUndo(serviceId)).toBe(false);
    await edits.remove(serviceId, first);
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'read-only', message: 'Changed'},
    });
    await edits.undo(serviceId);
    expect(edits.canUndo(serviceId)).toBe(true);
    expect(edits.canRedo(serviceId)).toBe(false);
  });

  it('records an applied edit even when its disk write fails', async () => {
    const {edits, edit, ids} = fixture();
    const save = edit.getMockImplementation();
    if (save === undefined) throw new Error('Missing save');
    edit.mockImplementationOnce(async command => {
      const applied = await save(command);
      if (!applied.ok) return applied;
      return {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Disk full',
          applied: applied.value,
          unchangedFiles: ['invented.llservice'],
        },
      };
    });
    expect(await edits.remove(serviceId, second)).toMatchObject({
      ok: false,
      error: {reason: 'write-failed'},
    });
    expect(edits.canUndo(serviceId)).toBe(true);
    await edits.undo(serviceId);
    expect(ids()).toEqual([first, second, third]);
  });

  it('locks concurrent edits and releases the lock after a rejected request', async () => {
    const {api, edits, edit} = fixture();
    let rejectRead: (error: Error) => void = () => undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRead = reject;
        }),
    );
    const pending = edits.remove(serviceId, second);
    expect(await edits.move(serviceId, first, null)).toMatchObject({
      ok: false,
      error: {reason: 'busy'},
    });
    rejectRead(new Error('IPC failed'));
    expect(await pending).toMatchObject({
      ok: false,
      error: {reason: 'request-failed', message: 'IPC failed'},
    });
    await edits.remove(serviceId, second);
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it('does not undo another service and can release its bounded history', async () => {
    const {edits, edit} = fixture();
    await edits.remove(serviceId, second);
    expect(edits.canUndo(otherId)).toBe(false);
    expect(await edits.undo(otherId)).toEqual({ok: true, value: false});
    edits.clear();
    expect(edits.canUndo(serviceId)).toBe(false);
    expect(await edits.undo(serviceId)).toEqual({ok: true, value: false});
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it('bounds undo and redo to the newest 100 edits', async () => {
    const {edits} = fixture();
    for (let index = 0; index < 105; index++) {
      await edits.move(serviceId, second, index % 2 === 0 ? null : first);
    }
    let undone = 0;
    while (edits.canUndo(serviceId)) {
      expect(await edits.undo(serviceId)).toEqual({ok: true, value: true});
      undone++;
    }
    expect(undone).toBe(100);
    let redone = 0;
    while (edits.canRedo(serviceId)) {
      await edits.redo(serviceId);
      redone++;
    }
    expect(redone).toBe(100);
  });
});
