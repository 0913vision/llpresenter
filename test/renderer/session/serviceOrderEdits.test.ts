import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import * as v from 'valibot';
import {describe, expect, it, vi} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import {
  parseServiceDocument,
  parseSongDocument,
} from '@core/schema/contentDocuments';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
  createThemeId,
  translationIdSchema,
} from '@core/schema/ids';
import {withStartField} from '@core/services/itemFieldChanges';
import {themeRequest} from '@renderer/features/service/items/itemAppearanceCommands';
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {SERVICE_LIMITS} from '@core/schema/service';
import {
  ORDER_FULL_REASON,
  ServiceOrderEdits,
  serviceOrderEditsFor,
} from '@renderer/session/serviceOrderEdits';

const THEME_ID = '40000000-0000-4000-8000-000000000001';
const MACRO_ID = '50000000-0000-4000-8000-000000000001';
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
        {
          slides: [],
          id: second,
          song: songId,
          memo: 'Keep this',
          futureField: [1, 2],
        },
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
      slides: [{id: fixtureSlideId(1), lines: ['Invented words']}],
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
  const api = mockLlpApi({
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
  it('inserts a prepared Bible item at the end of a selected section', async () => {
    const {edits, ids, state} = fixture();
    if (state.document === null) throw new Error('Missing document');
    const next = createServiceItemId('20000000-0000-4000-8000-000000000015');
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: [
          ...state.document.service.order,
          {id: next, header: 'Next section'},
        ],
      },
    };
    const bible = {
      id: createServiceItemId('20000000-0000-4000-8000-000000000014'),
      bible: {
        translation: v.parse(translationIdSchema, 'krv'),
        ref: 'John 3:16',
        split: 'verse' as const,
        reference: 'every' as const,
        verseNumbers: true,
      },
    };
    await edits.insertItemInSection(serviceId, first, async () => bible);
    expect(ids()).toEqual([first, second, third, bible.id, next]);
  });
  it('moves noncontiguous selected items across a section header and undoes once', async () => {
    const {edits, state, ids} = fixture();
    if (state.document === null) throw new Error('Missing document');
    const fourth = createServiceItemId('20000000-0000-4000-8000-000000000004');
    const fifth = createServiceItemId('20000000-0000-4000-8000-000000000005');
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: [
          ...state.document.service.order,
          {id: fourth, header: 'Second section'},
          {id: fifth, song: songId, slides: []},
        ],
      },
    };
    await edits.moveStep(serviceId, [second, fifth], 'up');
    expect(ids()).toEqual([second, first, third, fifth, fourth]);
    await edits.undo(serviceId);
    expect(ids()).toEqual([first, second, third, fourth, fifth]);
  });
  it('moves multiple selected items by one position and undoes them together', async () => {
    const {edits, ids, edit} = fixture();
    await edits.moveStep(serviceId, [second, third], 'up');
    expect(ids()).toEqual([second, third, first]);
    expect(edit).toHaveBeenCalledTimes(1);
    await edits.undo(serviceId);
    expect(ids()).toEqual([first, second, third]);
  });
  it('pastes several complete items after a row as one undo and redo step, or appends them', async () => {
    const {edits, ids, edit} = fixture();
    const copied = [
      {
        id: createServiceItemId('20000000-0000-4000-8000-000000000011'),
        header: 'Copied header',
      },
      {
        id: createServiceItemId('20000000-0000-4000-8000-000000000012'),
        futureKind: {slides: ['Keep']},
      },
    ];
    expect(await edits.insertItems(serviceId, copied, first)).toEqual({
      ok: true,
      value: true,
    });
    expect(ids()).toEqual([
      first,
      ...copied.map(item => item.id),
      second,
      third,
    ]);
    expect(edit).toHaveBeenCalledOnce();
    await edits.undo(serviceId);
    expect(ids()).toEqual([first, second, third]);
    await edits.redo(serviceId);
    expect(ids()).toEqual([
      first,
      ...copied.map(item => item.id),
      second,
      third,
    ]);
    await edits.undo(serviceId);
    await edits.insertItems(serviceId, copied, null);
    expect(ids()).toEqual([
      first,
      second,
      third,
      ...copied.map(item => item.id),
    ]);
  });

  it('refuses an entire paste if its anchor disappeared or the whole selection cannot fit', async () => {
    const {edits, state, edit} = fixture();
    const copied = [
      {
        id: createServiceItemId('20000000-0000-4000-8000-000000000011'),
        header: 'One',
      },
      {
        id: createServiceItemId('20000000-0000-4000-8000-000000000012'),
        header: 'Two',
      },
    ];
    expect(
      await edits.insertItems(serviceId, copied, copied[0]?.id ?? first),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    if (state.document === null) throw new Error('Missing document');
    state.document = {
      ...state.document,
      service: {
        ...state.document.service,
        order: Array.from({length: SERVICE_LIMITS.items - 1}, (_, index) => ({
          id: createServiceItemId(
            `90000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          ),
          header: 'Header',
        })),
      },
    };
    expect(await edits.insertItems(serviceId, copied, null)).toMatchObject({
      ok: false,
      error: {reason: 'full'},
    });
    expect(edit).not.toHaveBeenCalled();
    expect(edits.canUndo(serviceId)).toBe(false);
  });

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
      {slides: [], id: tail, song: songId},
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

  it('copies the song theme to a new service item', async () => {
    const {state, edits} = fixture();
    if (!state.song) throw new Error('No song');
    state.song = {
      ...state.song,
      song: {...state.song.song, theme: LIGHT_SONG_THEME_ID},
    };
    await edits.insertSong(serviceId, songId, null);
    expect(state.document?.service.order.at(-1)).toMatchObject({
      theme: LIGHT_SONG_THEME_ID,
    });
  });

  it('inserts separate song references with generated ids and inherited defaults', async () => {
    const {state, edits, ids} = fixture();
    await edits.insertSong(serviceId, songId, second);
    await edits.insertSong(serviceId, songId, null);
    const order = state.document?.service.order ?? [];
    expect(order[1]).toEqual({
      slides: state.song?.song.slides,
      id: order[1]?.id,
      song: songId,
    });
    expect(order.at(-1)).toEqual({
      slides: state.song?.song.slides,
      id: order.at(-1)?.id,
      song: songId,
    });
    expect(new Set(ids()).size).toBe(5);
    await edits.undo(serviceId);
    expect(ids()).toHaveLength(4);
  });

  it('inserts a ready-made item before another, or at the end, and undoes it', async () => {
    const {state, edits, ids} = fixture();
    const header = {
      id: createServiceItemId('90000000-0000-4000-8000-000000000001'),
      header: '구역',
    };
    const emptySection = {
      id: createServiceItemId('90000000-0000-4000-8000-000000000002'),
      header: '빈 구역',
    };
    await edits.insertItem(serviceId, header, second);
    await edits.insertItem(serviceId, emptySection, null);
    const order = state.document?.service.order ?? [];
    expect(order[1]).toEqual(header);
    expect(order.at(-1)).toEqual(emptySection);
    expect(ids()).toHaveLength(5);
    await edits.undo(serviceId);
    expect(ids()).toHaveLength(4);
    expect(
      await edits.insertItem(
        serviceId,
        emptySection,
        createServiceItemId('90000000-0000-4000-8000-0000000000ff'),
      ),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
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
            ? {
                slides: [],
                futureField: [1, 2],
                memo: 'Keep this',
                song: songId,
                id: second,
              }
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

  it('undoes and redoes every kind of item edit as one step each, in the order they were made', async () => {
    const {api, state, edits} = fixture();
    const memoOf = () =>
      state.document?.service.order.find(item => item.id === second);
    const changes = [
      withStartField('memo', '새 메모'),
      themeRequest(null, createThemeId(THEME_ID)).change,
      withStartField('macro', MACRO_ID),
    ];
    const original = memoOf();
    for (const change of changes) {
      await updateServiceItem(api, {serviceId, itemId: second, change});
    }
    const finished = memoOf();
    expect(finished).toMatchObject({
      memo: '새 메모',
      theme: THEME_ID,
      macro: MACRO_ID,
    });
    for (const step of changes.keys()) {
      expect(edits.canUndo(serviceId), `undo ${step}`).toBe(true);
      expect(await edits.undo(serviceId)).toEqual({ok: true, value: true});
    }
    expect(memoOf()).toEqual(original);
    expect(edits.canUndo(serviceId)).toBe(false);
    for (const step of changes.keys()) {
      expect(await edits.redo(serviceId), `redo ${step}`).toEqual({
        ok: true,
        value: true,
      });
    }
    expect(memoOf()).toEqual(finished);
  });

  it('records a memo saved in one go as a single step and an unchanged save as none', async () => {
    const {api, state, edits} = fixture();
    await updateServiceItem(api, {
      serviceId,
      itemId: second,
      change: item => ({...item, memo: '한 번에 쓴 메모'}),
    });
    await updateServiceItem(api, {
      serviceId,
      itemId: second,
      change: item => item,
    });
    expect(await edits.undo(serviceId)).toEqual({ok: true, value: true});
    expect(state.document?.service.order[1]).toMatchObject({memo: 'Keep this'});
    expect(edits.canUndo(serviceId)).toBe(false);
  });

  it('undoes an item edit after an order edit and the other way round', async () => {
    const {api, ids, state, edits} = fixture();
    await updateServiceItem(api, {
      serviceId,
      itemId: second,
      change: item => ({...item, memo: '먼저'}),
    });
    await edits.move(serviceId, second, null);
    expect(ids()).toEqual([first, third, second]);
    await edits.undo(serviceId);
    expect(ids()).toEqual([first, second, third]);
    await edits.undo(serviceId);
    expect(state.document?.service.order[1]).toMatchObject({memo: 'Keep this'});
  });

  it('records no step for an item edit the main process refuses, and keeps the earlier step on top', async () => {
    const {api, edit, edits, ids, state} = fixture();
    await edits.remove(serviceId, third);
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    const result = await updateServiceItem(api, {
      serviceId,
      itemId: second,
      change: item => ({...item, memo: '거절된 메모'}),
    });
    expect(result).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(await edits.undo(serviceId)).toEqual({ok: true, value: true});
    expect(ids()).toEqual([first, second, third]);
    expect(state.document?.service.order[1]).toMatchObject({memo: 'Keep this'});
    expect(edits.canUndo(serviceId)).toBe(false);
  });

  it('records the step of an item edit whose disk write failed after it applied, as order edits do', async () => {
    const {api, edit, edits, state} = fixture();
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
    await updateServiceItem(api, {
      serviceId,
      itemId: second,
      change: item => ({...item, memo: '디스크 오류 메모'}),
    });
    expect(edits.canUndo(serviceId)).toBe(true);
    await edits.undo(serviceId);
    expect(state.document?.service.order[1]).toMatchObject({memo: 'Keep this'});
  });

  it('records no step for an item edit whose request throws', async () => {
    const {api, edit, edits} = fixture();
    edit.mockRejectedValueOnce(new Error('Connection lost'));
    const result = await updateServiceItem(api, {
      serviceId,
      itemId: second,
      change: item => ({...item, memo: '끊긴 메모'}),
    });
    expect(result).toMatchObject({
      ok: false,
      error: {reason: 'request-failed'},
    });
    expect(edits.canUndo(serviceId)).toBe(false);
  });

  it('counts item edits and order edits against the same 100 steps', async () => {
    const {api, edits} = fixture();
    for (let index = 0; index < 60; index++) {
      await updateServiceItem(api, {
        serviceId,
        itemId: second,
        change: item => ({...item, memo: `메모 ${index}`}),
      });
    }
    for (let index = 0; index < 60; index++) {
      await edits.move(serviceId, second, index % 2 === 0 ? null : first);
    }
    let undone = 0;
    while (edits.canUndo(serviceId)) {
      expect(await edits.undo(serviceId)).toEqual({ok: true, value: true});
      undone++;
    }
    expect(undone).toBe(100);
  });

  it('copies an item right after itself with a new id and every field, as one undo step', async () => {
    const {edits, state} = fixture();
    const copyId = createServiceItemId('20000000-0000-4000-8000-000000000099');
    expect(await edits.duplicate(serviceId, second, copyId)).toEqual({
      ok: true,
      value: true,
    });
    const order = state.document?.service.order ?? [];
    expect(order.map(item => item.id)).toEqual([first, second, copyId, third]);
    expect(order[2]).toEqual({...order[1], id: copyId});
    await edits.undo(serviceId);
    expect(state.document?.service.order.map(item => item.id)).toEqual([
      first,
      second,
      third,
    ]);
    expect(edits.canUndo(serviceId)).toBe(false);
  });

  it('copies a whole 구역 with its items after the section and names the copy header', async () => {
    const {edits, state} = fixture();
    const copyId = createServiceItemId('20000000-0000-4000-8000-000000000098');
    await edits.duplicate(serviceId, first, copyId);
    const order = state.document?.service.order ?? [];
    expect(order).toHaveLength(6);
    expect(order[3]).toMatchObject({
      id: copyId,
      header: 'Invented header 복사본',
    });
    expect(order[4]).toMatchObject({song: songId, memo: 'Keep this'});
    expect(order[4]?.id).not.toBe(second);
    expect(order[5]).toMatchObject({futureKind: {keep: true}});
    await edits.undo(serviceId);
    expect(state.document?.service.order).toHaveLength(3);
    expect(edits.canUndo(serviceId)).toBe(false);
  });

  it('refuses an add, a copy, and a 구역 copy past the item limit with the limit sentence, and allows the last free place', async () => {
    const {edits, state, edit} = fixture();
    const fill = (count: number): void => {
      if (state.document === null) throw new Error('No document');
      const filler = Array.from({length: count}, (_, index) => ({
        id: createServiceItemId(
          `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        ),
        header: '구역',
      }));
      state.document = {
        ...state.document,
        service: {...state.document.service, order: filler},
      };
    };
    fill(SERVICE_LIMITS.items);
    const header = state.document?.service.order[0];
    if (header === undefined) throw new Error('No item');
    const fresh = createServiceItemId('20000000-0000-4000-8000-000000000090');
    for (const result of [
      await edits.insertItem(serviceId, {id: fresh, header: 'New'}, null),
      await edits.insertSong(serviceId, songId, null),
      await edits.duplicate(serviceId, header.id, fresh),
    ]) {
      expect(result).toEqual({
        ok: false,
        error: {reason: 'full', message: ORDER_FULL_REASON},
      });
    }
    expect(edit).not.toHaveBeenCalled();
    fill(SERVICE_LIMITS.items - 1);
    expect(
      await edits.insertItem(serviceId, {id: fresh, header: 'New'}, null),
    ).toEqual({ok: true, value: true});
    expect(state.document?.service.order).toHaveLength(SERVICE_LIMITS.items);
  });

  it('refuses a copy of an item that is gone', async () => {
    const {edits, edit} = fixture();
    const gone = createServiceItemId('20000000-0000-4000-8000-000000000077');
    expect(
      await edits.duplicate(
        serviceId,
        gone,
        createServiceItemId('20000000-0000-4000-8000-000000000078'),
      ),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(edit).not.toHaveBeenCalled();
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

describe('serviceOrderEditsFor', () => {
  it('shares one edit history with every entry point of the same window', () => {
    const api = mockLlpApi();

    expect(serviceOrderEditsFor(api)).toBe(serviceOrderEditsFor(api));
    expect(serviceOrderEditsFor(mockLlpApi())).not.toBe(
      serviceOrderEditsFor(api),
    );
  });
});

it('removes and duplicates a complete selection with one write and one undo', async () => {
  const {edits, ids, edit, state} = fixture();
  const before = state.document?.service.order;
  await edits.removeMany(serviceId, [third, second]);
  expect(ids()).toEqual([first]);
  expect(edit).toHaveBeenCalledTimes(1);
  await edits.undo(serviceId);
  expect(state.document?.service.order).toEqual(before);
  const a = createServiceItemId('20000000-0000-4000-8000-000000000011');
  const b = createServiceItemId('20000000-0000-4000-8000-000000000012');
  await edits.duplicateMany(
    serviceId,
    new Map([
      [third, b],
      [second, a],
    ]),
  );
  expect(ids()).toEqual([first, second, third, a, b]);
  expect(state.document?.service.order[3]).toMatchObject({
    memo: 'Keep this',
    futureField: [1, 2],
  });
  await edits.undo(serviceId);
  expect(state.document?.service.order).toEqual(before);
});
it('rejects a vanished member atomically and moves a set in document order', async () => {
  const {edits, ids, edit} = fixture();
  const missing = createServiceItemId('20000000-0000-4000-8000-000000000099');
  expect(await edits.removeMany(serviceId, [second, missing])).toMatchObject({
    ok: false,
  });
  expect(edit).not.toHaveBeenCalled();
  await edits.moveMany(serviceId, [third, second], first);
  expect(ids()).toEqual([second, third, first]);
  expect(edit).toHaveBeenCalledTimes(1);
  await edits.undo(serviceId);
  expect(ids()).toEqual([first, second, third]);
});
