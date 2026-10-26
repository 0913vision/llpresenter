import {expect, it, vi} from 'vitest';
import type {SettingsEdit} from '@shared/schema/settingsDocuments';
import type {EditResult} from '@shared/schema/contentEdit';
import {parseLookId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {
  looksDocument,
  screensDocument,
  SERMON_LOOK_ID,
} from '../testing/documents';
import {LookListEditor} from './lookListEditor';

function document() {
  const value = looksDocument();
  if (value.name !== 'looks') throw new Error('Expected looks');
  return value;
}

function id(value: string) {
  const parsed = parseLookId(value);
  if (!parsed.ok) throw new Error('Invalid fixture id');
  return parsed.value;
}

const added = id('00000000-0000-4000-8000-0000000000a3');
const another = id('00000000-0000-4000-8000-0000000000a4');

it('queues additions on one revision and includes them in the close flush', async () => {
  const initial = document();
  const edits: SettingsEdit[] = [];
  const api = fakeLlpApi({
    settings: {
      edit: edit => {
        edits.push(edit);
        return Promise.resolve({
          ok: true,
          value: {id: 'looks', revision: edits.length + 1},
        });
      },
    },
  });
  const editor = new LookListEditor(api, vi.fn(), () => ({
    current: initial.value.current,
    macros: [],
  }));
  editor.adopt(initial);
  const first = editor.change({kind: 'add', id: added});
  const second = editor.change({kind: 'add', id: another});
  const closing = pendingWritesOf(api).flush();
  expect(await first).toEqual({ok: true, value: true});
  expect(await second).toEqual({ok: true, value: true});
  expect(await closing).toBe(true);
  expect(
    edits.map(edit => 'baseRevision' in edit && edit.baseRevision),
  ).toEqual([1, 2]);
  expect(
    editor
      .getSnapshot()
      ?.value.looks.slice(-2)
      .map(look => look.name),
  ).toEqual(['새 Look', '새 Look 2']);
});

it('uses the live context at queue execution before allowing deletion', async () => {
  const initial = document();
  let current = initial.value.current;
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const edit = vi.fn().mockReturnValue(held);
  const editor = new LookListEditor(
    fakeLlpApi({settings: {edit}}),
    vi.fn(),
    () => ({current, macros: []}),
  );
  editor.adopt(initial);
  const first = editor.change({kind: 'rename', id: current, name: '새 이름'});
  await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
  const second = editor.change({kind: 'delete', id: id(SERMON_LOOK_ID)});
  current = id(SERMON_LOOK_ID);
  release({ok: true, value: {id: 'looks', revision: 2}});
  await first;
  expect(await second).toEqual({ok: false, error: {reason: 'current'}});
  expect(edit).toHaveBeenCalledOnce();
});

it('refuses writes to read-only documents', async () => {
  const initial = document();
  const edit = vi.fn();
  const editor = new LookListEditor(
    fakeLlpApi({settings: {edit}}),
    vi.fn(),
    () => ({current: initial.value.current, macros: []}),
  );
  editor.adopt({...initial, access: 'readOnly'});
  expect(await editor.change({kind: 'add', id: added})).toEqual({
    ok: true,
    value: false,
  });
  expect(edit).not.toHaveBeenCalled();
});

it('shares the close-tracked queue between list and card edits', async () => {
  const initial = document();
  const screens = screensDocument();
  if (screens.name !== 'screens') throw new Error('Wrong screens document');
  const screen = screens.value.screens[0];
  if (screen === undefined) throw new Error('Missing screen');
  let release: (result: EditResult) => void = () => undefined;
  const held = new Promise<EditResult>(resolve => {
    release = resolve;
  });
  const edits: SettingsEdit[] = [];
  const api = fakeLlpApi({
    settings: {
      edit: edit => {
        edits.push(edit);
        return edits.length === 1
          ? held
          : Promise.resolve({
              ok: true,
              value: {id: 'looks', revision: edits.length + 1},
            });
      },
    },
  });
  const editor = new LookListEditor(api, vi.fn(), () => ({
    current: initial.value.current,
    macros: [],
  }));
  editor.adopt(initial);
  const first = editor.change({
    kind: 'rename',
    id: initial.value.current,
    name: '새 이름',
  });
  await vi.waitFor(() => expect(edits).toHaveLength(1));
  const second = editor.changeCard({
    lookId: initial.value.current,
    screenId: screen.id,
    change: {kind: 'layer', layer: 'media', on: false},
  });
  const third = editor.changeCard({
    lookId: initial.value.current,
    screenId: screen.id,
    change: {kind: 'layer', layer: 'slide', on: false},
  });
  let closed = false;
  const closing = pendingWritesOf(api)
    .flush()
    .then(value => {
      closed = true;
      return value;
    });
  await Promise.resolve();
  expect(closed).toBe(false);
  release({ok: true, value: {id: 'looks', revision: 2}});
  await first;
  expect(await second).toBe(true);
  expect(await third).toBe(true);
  expect(await closing).toBe(true);
  expect(
    edits.map(edit => 'baseRevision' in edit && edit.baseRevision),
  ).toEqual([1, 2, 3]);
  expect(editor.getSnapshot()?.value.looks[0]).toMatchObject({
    name: '새 이름',
    screens: {
      [screen.id]: {layers: {media: false, slide: false, message: true}},
    },
  });
});
