import {expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {saveMacroEdit} from './macroEdits';

const raw = {
  id: '00000000-0000-4000-8000-000000000001',
  name: ' 시작 ',
  icon: 'star',
  color: 'teal',
  actions: [],
};
const group = {
  id: '00000000-0000-4000-8000-000000000002',
  name: '주일',
  macroIds: [],
  future: 'kept',
};
function document(
  macros: readonly object[] = [],
  collections: readonly object[] = [group],
  revision = 1,
) {
  const parsed = parseSettingsDocument({
    name: 'macros',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.macros',
      schemaVersion: 1,
      macros,
      collections,
      future: 'kept',
    },
  });
  if (!parsed.ok || parsed.value.name !== 'macros') {
    throw new Error('Invalid macro fixture');
  }
  return parsed.value;
}
const item = document([raw]).value.macros[0];
const collection = document().value.collections[0];
if (!item || !collection) throw new Error('Missing fixture');

it('adds to the shown collection and removes memberships on deletion', async () => {
  const full = document(
    [{...raw, name: '시작', future: true}],
    [{...group, macroIds: [item.id]}],
  );
  const get = vi.fn().mockResolvedValueOnce(document()).mockResolvedValue(full);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'macros', revision: 2}});
  const api = fakeLlpApi({settings: {get, edit}});
  await saveMacroEdit(api, {kind: 'add', item, collection: collection.id});
  expect(edit).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      value: {
        ...document().value,
        macros: [{...item, name: '시작'}],
        collections: [{...group, macroIds: [item.id]}],
      },
    }),
  );
  await saveMacroEdit(api, {kind: 'delete', id: item.id});
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      value: {
        ...full.value,
        macros: [],
        collections: [{...group, macroIds: []}],
      },
    }),
  );
});

it('retries a stale partial edit on the latest settings while close waits for the read', async () => {
  const read = deferred<ReturnType<typeof document>>();
  const newer = document([{...raw, color: 'rose', future: true}], [group], 2);
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
  const writing = saveMacroEdit(api, {
    kind: 'update',
    id: item.id,
    changes: {name: '새 이름'},
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
        macros: [{...raw, name: '새 이름', color: 'rose', future: true}],
      },
    }),
  );
});

it('updates memberships without duplicates and reports persistence failures as applied', async () => {
  const doc = document([raw], [{...group, macroIds: [item.id]}]);
  const failure = {
    ok: false,
    error: {reason: 'write-failed', message: 'disk'},
  } as const;
  const edit = vi.fn().mockResolvedValue(failure);
  const api = fakeLlpApi({settings: {get: async () => doc, edit}});
  await expect(
    saveMacroEdit(api, {
      kind: 'membership',
      id: item.id,
      collection: collection.id,
      member: true,
    }),
  ).resolves.toMatchObject({ok: true});
  expect(edit).not.toHaveBeenCalled();
  await expect(
    saveMacroEdit(api, {
      kind: 'membership',
      id: item.id,
      collection: collection.id,
      member: false,
    }),
  ).resolves.toEqual(failure);
  expect(edit).toHaveBeenCalledWith(
    expect.objectContaining({
      value: {...doc.value, collections: [{...group, macroIds: []}]},
    }),
  );
  await expect(
    saveMacroEdit(api, {kind: 'update', id: item.id, changes: {name: ' '}}),
  ).rejects.toThrow('Invalid macro name');
});

it('duplicates next to its source in the list and its collections', async () => {
  const copyId = document([
    {...raw, id: '00000000-0000-4000-8000-000000000003'},
  ]).value.macros[0]?.id;
  if (!copyId) throw new Error('Missing copy ID');
  const doc = document(
    [{...raw, name: 'Source', future: true}],
    [{...group, macroIds: [item.id]}],
  );
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'macros', revision: 2}});
  const api = fakeLlpApi({settings: {get: async () => doc, edit}});
  await saveMacroEdit(api, {kind: 'duplicate', id: item.id, copyId});
  expect(edit).toHaveBeenCalledWith(
    expect.objectContaining({
      value: {
        ...doc.value,
        macros: [
          doc.value.macros[0],
          {
            ...doc.value.macros[0],
            id: copyId,
            name: 'Source \ubcf5\uc0ac\ubcf8',
          },
        ],
        collections: [{...group, macroIds: [item.id, copyId]}],
      },
    }),
  );
});

it('duplicates the latest source after a stale revision and treats a repeated ID as applied', async () => {
  const copyId = document([
    {...raw, id: '00000000-0000-4000-8000-000000000003'},
  ]).value.macros[0]?.id;
  if (!copyId) throw new Error('Missing copy ID');
  const newer = document([{...raw, name: 'Newer', color: 'rose'}], [group], 2);
  const get = vi
    .fn()
    .mockResolvedValueOnce(document([raw]))
    .mockResolvedValueOnce(newer);
  const edit = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'stale'},
    })
    .mockResolvedValue({ok: true, value: {id: 'macros', revision: 3}});
  await saveMacroEdit(fakeLlpApi({settings: {get, edit}}), {
    kind: 'duplicate',
    id: item.id,
    copyId,
  });
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      baseRevision: 2,
      value: {
        ...newer.value,
        macros: [
          newer.value.macros[0],
          {
            ...newer.value.macros[0],
            id: copyId,
            name: 'Newer \ubcf5\uc0ac\ubcf8',
          },
        ],
      },
    }),
  );
  const existing = document([raw, {...raw, id: copyId}], [group], 3);
  const retry = vi.fn();
  await saveMacroEdit(
    fakeLlpApi({settings: {get: async () => existing, edit: retry}}),
    {kind: 'duplicate', id: item.id, copyId},
  );
  expect(retry).not.toHaveBeenCalled();
});
