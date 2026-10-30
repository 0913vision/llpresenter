import {expect, it, vi} from 'vitest';
import * as v from 'valibot';
import type {EditResult} from '@core/schema/contentEdit';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {looksSchema} from '@core/schema/looks';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {looksDocument} from '../testing/documents';
import {editLyricStyle} from '@core/looks/lyricStyleEdits';
import {LookListEditor} from './lookListEditor';

function fixture() {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Wrong fixture');
  const value = v.parse(looksSchema, {
    ...document.value,
    extra: 'kept',
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000301',
        name: '공유',
        extra: 'style',
      },
    ],
  });
  const style = value.lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  return {document: {...document, value}, style};
}

it('updates one shared preset while preserving references and unknown fields', () => {
  const {document, style} = fixture();
  const result = editLyricStyle(document.value, {
    id: style.id,
    change: {size: 96, color: '#00FF00'},
  });
  expect(result).toMatchObject({
    extra: 'kept',
    lyricStyles: [{...style, size: 96, color: '#00FF00'}],
  });
  expect(result?.looks).toBe(document.value.looks);
  expect(document.value.lyricStyles[0]?.size).toBe(84);
});

it.each([
  {size: 0},
  {size: Number.NaN},
  {margin: 101},
  {maxLines: 1.5},
  {font: ' '},
  {color: 'red'},
])('refuses invalid style fields %o', change => {
  const {document, style} = fixture();
  expect(
    editLyricStyle(document.value, {id: style.id, change}),
  ).toBeUndefined();
});

it('serializes rapid changes with list edits and waits for them during close', async () => {
  const {document, style} = fixture();
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const writes: SettingsEdit[] = [];
  const api = fakeLlpApi({
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
  const first = editor.changeStyle({id: style.id, change: {size: 96}});
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  const second = editor.changeStyle({
    id: style.id,
    change: {margin: 12, weight: 400, lineHeight: 1.45},
  });
  const third = editor.change({
    kind: 'rename',
    id: document.value.current,
    name: '보존',
  });
  let closed = false;
  const closing = pendingWritesOf(api)
    .flush()
    .then(result => {
      closed = true;
      return result;
    });
  await Promise.resolve();
  expect(closed).toBe(false);
  release({ok: true, value: {id: 'looks', revision: 2}});
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(await third).toEqual({ok: true, value: true});
  expect(await closing).toBe(true);
  expect(editor.getSnapshot()?.value.lyricStyles[0]).toMatchObject({
    size: 96,
    margin: 12,
    weight: 400,
    lineHeight: 1.45,
  });
  expect(writes.at(-1)).toMatchObject({
    name: 'looks',
    value: {
      lyricStyles: [expect.objectContaining({weight: 400, lineHeight: 1.45})],
    },
  });
  expect(
    writes.map(edit => 'baseRevision' in edit && edit.baseRevision),
  ).toEqual([1, 2, 3]);
});

it('skips an unchanged font but preserves a queued return to it behind a held save', async () => {
  const {document, style} = fixture();
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const writes: SettingsEdit[] = [];
  const api = fakeLlpApi({
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
  expect(
    await editor.changeStyle({id: style.id, change: {font: style.font}}),
  ).toBe(true);
  expect(writes).toHaveLength(0);
  const first = editor.changeStyle({
    id: style.id,
    change: {font: 'Fixture Sans'},
  });
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  const second = editor.changeStyle({id: style.id, change: {font: style.font}});
  release({ok: true, value: {id: 'looks', revision: 2}});
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(writes).toHaveLength(2);
  expect(editor.getSnapshot()?.value.lyricStyles[0]?.font).toBe(style.font);
});

it('refuses shared style writes for a read-only document', async () => {
  const {document, style} = fixture();
  const edit = vi.fn();
  const editor = new LookListEditor(
    fakeLlpApi({settings: {edit}}),
    vi.fn(),
    () => ({current: document.value.current, macros: []}),
  );
  editor.adopt({...document, access: 'readOnly'});
  expect(await editor.changeStyle({id: style.id, change: {size: 96}})).toBe(
    false,
  );
  expect(edit).not.toHaveBeenCalled();
});

it('preserves a color reversion queued behind a held settings save', async () => {
  const {document, style} = fixture();
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const writes: SettingsEdit[] = [];
  const api = fakeLlpApi({
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
  const first = editor.changeStyle({id: style.id, change: {color: '#112233'}});
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  const second = editor.changeStyle({
    id: style.id,
    change: {color: style.color},
  });
  release({ok: true, value: {id: 'looks', revision: 2}});
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(writes).toHaveLength(2);
  expect(editor.getSnapshot()?.value.lyricStyles[0]?.color).toBe(style.color);
});

it('preserves v2 effect parameters when a switch changes', () => {
  const {document, style} = fixture();
  const value = {
    ...document.value,
    lyricStyles: [
      {
        ...style,
        outline: {...style.outline, width: 8, color: '#112233'},
        shadow: {...style.shadow, angle: 180},
      },
    ],
  };
  const result = editLyricStyle(value, {
    id: style.id,
    change: {outline: true, shadow: false},
  });
  expect(result?.lyricStyles[0]).toMatchObject({
    outline: {on: true, width: 8, color: '#112233'},
    shadow: {on: false, angle: 180},
  });
});
