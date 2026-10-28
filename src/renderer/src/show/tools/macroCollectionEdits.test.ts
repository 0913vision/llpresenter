import {expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {saveMacroCollectionEdit} from './macroCollectionEdits';

const macro = {
  id: '00000000-0000-4000-8000-000000000001',
  name: '찬양',
  icon: 'star',
  color: 'teal',
  actions: [],
};
const raw = {
  id: '00000000-0000-4000-8000-000000000002',
  name: ' 주일 ',
  macroIds: [macro.id],
  future: true,
};
function document(collections: readonly object[] = [], revision = 1) {
  const parsed = parseSettingsDocument({
    name: 'macros',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.macros',
      schemaVersion: 1,
      macros: [macro],
      collections,
      future: true,
    },
  });
  if (!parsed.ok || parsed.value.name !== 'macros') {
    throw new Error('Invalid fixture');
  }
  return parsed.value;
}
const collection = document([raw]).value.collections[0];
if (!collection) throw new Error('Missing fixture');

it('adds, renames and deletes a collection without deleting macros or unknown fields', async () => {
  const old = document([raw]);
  const get = vi.fn().mockResolvedValueOnce(document()).mockResolvedValue(old);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'macros', revision: 2}});
  const api = fakeLlpApi({settings: {get, edit}});
  await saveMacroCollectionEdit(api, {kind: 'add', collection});
  expect(edit).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      value: {...document().value, collections: [{...raw, name: '주일'}]},
    }),
  );
  await saveMacroCollectionEdit(api, {
    kind: 'rename',
    id: collection.id,
    name: '새 이름',
  });
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      value: {...old.value, collections: [{...raw, name: '새 이름'}]},
    }),
  );
  await saveMacroCollectionEdit(api, {kind: 'delete', id: collection.id});
  expect(edit).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({value: {...old.value, collections: []}}),
  );
});

it('holds close through the read and preserves newer members after a stale retry', async () => {
  const read = deferred<ReturnType<typeof document>>();
  const newer = document([{...raw, macroIds: []}], 2);
  const get = vi
    .fn()
    .mockReturnValueOnce(read.promise)
    .mockResolvedValue(newer);
  const edit = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'stale'},
    })
    .mockResolvedValue({ok: true, value: {id: 'macros', revision: 3}});
  const api = fakeLlpApi({settings: {get, edit}});
  const writing = saveMacroCollectionEdit(api, {
    kind: 'rename',
    id: collection.id,
    name: '변경',
  });
  const flushed = pendingWritesOf(api).flush();
  read.resolve(document([raw]));
  await writing;
  await flushed;
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      baseRevision: 2,
      value: {
        ...newer.value,
        collections: [{...raw, name: '변경', macroIds: []}],
      },
    }),
  );
});

it('rejects missing collections and bad names and reports applied write failures', async () => {
  const failure = {
    ok: false,
    error: {reason: 'write-failed', message: 'disk'},
  } as const;
  const edit = vi.fn().mockResolvedValue(failure);
  const api = fakeLlpApi({settings: {get: async () => document(), edit}});
  await expect(
    saveMacroCollectionEdit(api, {kind: 'add', collection}),
  ).resolves.toEqual(failure);
  await expect(
    saveMacroCollectionEdit(api, {
      kind: 'rename',
      id: collection.id,
      name: '이름',
    }),
  ).rejects.toThrow('no longer exists');
  await expect(
    saveMacroCollectionEdit(api, {
      kind: 'add',
      collection: {...collection, name: ' '},
    }),
  ).rejects.toThrow('Invalid collection name');
});
