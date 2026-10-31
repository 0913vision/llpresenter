import {expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {parseLyricStyleId, screenIdSchema} from '@core/schema/ids';
import {looksSchema} from '@core/schema/looks';
import type {EditResult} from '@core/schema/contentEdit';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {looksDocument, MAIN_ID} from '@core/testing/screenDocuments';
import {editLyricStyleList, LYRIC_STYLE_LIMIT} from './lyricStyleListEdits';
import {LookListEditor} from './lookListEditor';

function id(suffix: string) {
  const parsed = parseLyricStyleId(
    `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`,
  );
  if (!parsed.ok) throw new Error('Bad fixture');
  return parsed.value;
}
const sourceId = id('301');
const spareId = id('302');
const addedId = id('303');

function fixture() {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Wrong fixture');
  const value = v.parse(looksSchema, {
    ...document.value,
    extra: 'file',
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: sourceId,
        name: ' 기본 ',
        size: 110,
        extra: 'style',
      },
      {...DEFAULT_LYRIC_STYLE, id: spareId, name: '새 스타일'},
    ],
  });
  return {...document, value};
}

it('copies the chosen preset, preserves unknown fields and generates an unused name', () => {
  const file = fixture().value;
  const result = editLyricStyleList(file, {
    kind: 'add',
    source: sourceId,
    id: addedId,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toMatchObject({extra: 'file'});
  expect(result.value.lyricStyles.at(-1)).toMatchObject({
    id: addedId,
    name: '새 스타일 2',
    size: 110,
    extra: 'style',
  });
  expect(result.value.looks).toBe(file.looks);
  expect(file.lyricStyles).toHaveLength(2);
});

it('creates a default preset from an empty list and can delete the last unused preset', () => {
  const added = editLyricStyleList(
    {...fixture().value, lyricStyles: []},
    {kind: 'add', id: addedId},
  );
  if (!added.ok) throw new Error('Expected addition');
  expect(added.value.lyricStyles[0]).toMatchObject({
    ...DEFAULT_LYRIC_STYLE,
    id: addedId,
    name: '새 스타일',
  });
  const removed = editLyricStyleList(added.value, {
    kind: 'delete',
    id: addedId,
  });
  expect(removed.ok && removed.value.lyricStyles).toEqual([]);
});

it('validates names and missing or duplicate targets', () => {
  const file = fixture().value;
  expect(
    editLyricStyleList(file, {kind: 'rename', id: sourceId, name: ' '}),
  ).toEqual({ok: false, error: 'empty'});
  expect(
    editLyricStyleList(file, {kind: 'rename', id: spareId, name: '기본'}),
  ).toEqual({ok: false, error: 'taken'});
  expect(editLyricStyleList(file, {kind: 'delete', id: addedId})).toEqual({
    ok: false,
    error: 'missing',
  });
  expect(editLyricStyleList(file, {kind: 'add', id: sourceId})).toEqual({
    ok: false,
    error: 'duplicate-id',
  });
  const renamed = editLyricStyleList(file, {
    kind: 'rename',
    id: sourceId,
    name: ' 바뀐 이름 ',
  });
  expect(renamed.ok && renamed.value.lyricStyles[0]?.name).toBe('바뀐 이름');
});

it('keeps an unchanged normalized name without replacing the document', () => {
  const original = fixture().value;
  const file = {
    ...original,
    lyricStyles: original.lyricStyles.map(style =>
      style.id === sourceId ? {...style, name: '기본'} : style,
    ),
  };
  const result = editLyricStyleList(file, {
    kind: 'rename',
    id: sourceId,
    name: ' 기본 ',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected unchanged name');
  expect(result.value).toBe(file);
});

it('serializes a style name reversion behind a held rename', async () => {
  const document = fixture();
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const writes: SettingsEdit[] = [];
  const api = mockLlpApi({
    settings: {
      edit: edit => {
        writes.push(edit);
        return writes.length === 1
          ? held
          : Promise.resolve({ok: true, value: {id: 'looks', revision: 3}});
      },
    },
  });
  const editor = new LookListEditor(api, vi.fn(), () => ({
    current: document.value.current,
    macros: [],
  }));
  editor.adopt(document);
  const first = editor.changeStyleList({
    kind: 'rename',
    id: sourceId,
    name: '임시 스타일',
  });
  const second = editor.changeStyleList({
    kind: 'rename',
    id: sourceId,
    name: '기본',
  });
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  release({ok: true, value: {id: 'looks', revision: 2}});
  expect(await first).toEqual({ok: true, value: true});
  expect(await second).toEqual({ok: true, value: true});
  expect(editor.getSnapshot()?.value.lyricStyles[0]?.name).toBe('기본');
  expect(writes).toHaveLength(2);
});

it('caps new presets while retaining imported presets', () => {
  const file = fixture().value;
  const prototype = file.lyricStyles[0];
  if (prototype === undefined) throw new Error('Missing style');
  const full = {
    ...file,
    lyricStyles: Array.from({length: LYRIC_STYLE_LIMIT}, (_, index) => ({
      ...prototype,
      id: id(String(index + 1000)),
    })),
  };
  expect(editLyricStyleList(full, {kind: 'add', id: addedId})).toEqual({
    ok: false,
    error: 'full',
  });
  expect(full.lyricStyles).toHaveLength(LYRIC_STYLE_LIMIT);
});

it('checks queued references before deletion and includes both operations in the close flush', async () => {
  const document = fixture();
  const look = document.value.looks[1];
  if (look === undefined) throw new Error('Missing inactive Look');
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const writes: SettingsEdit[] = [];
  const api = mockLlpApi({
    settings: {
      edit: edit => {
        writes.push(edit);
        return writes.length === 1
          ? held
          : Promise.resolve({
              ok: true,
              value: {id: 'looks', revision: writes.length + 1},
            });
      },
    },
  });
  const editor = new LookListEditor(api, vi.fn(), () => ({
    current: document.value.current,
    macros: [],
  }));
  editor.adopt(document);
  const first = editor.changeStyle({id: sourceId, change: {size: 120}});
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  const assigned = editor.changeCard({
    lookId: look.id,
    screenId: v.parse(screenIdSchema, MAIN_ID),
    change: {kind: 'lyricStyle', id: spareId},
  });
  const removed = editor.changeStyleList({kind: 'delete', id: spareId});
  const closing = pendingWritesOf(api).flush();
  release({ok: true, value: {id: 'looks', revision: 2}});
  expect(await first).toBe(true);
  expect(await assigned).toBe(true);
  expect(await removed).toEqual({ok: false, error: 'used'});
  expect(await closing).toBe(true);
  expect(writes).toHaveLength(2);
});
