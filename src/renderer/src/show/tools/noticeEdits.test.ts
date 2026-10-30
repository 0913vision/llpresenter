import {expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {noticeReason, saveNoticeEdit} from './noticeEdits';

const raw = {
  id: '00000000-0000-4000-8000-000000000001',
  name: ' 공지 ',
  media: ['00000000-0000-4000-8000-000000000002'],
  interval: 8,
  loop: true,
  targets: ['00000000-0000-4000-8000-000000000003'],
};
function document(sets: readonly object[] = [], revision = 1) {
  const result = parseSettingsDocument({
    name: 'notices',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.notices',
      schemaVersion: 1,
      sets,
      future: 'kept',
    },
  });
  if (!result.ok || result.value.name !== 'notices') {
    throw new Error('Invalid fixture');
  }
  return result.value;
}
const item = document([raw]).value.sets[0];
if (!item) throw new Error('Missing fixture');

it('adds, updates and deletes a set while preserving unknown fields', async () => {
  const old = document([{...raw, name: '이전', future: 'kept'}]);
  const get = vi.fn().mockResolvedValueOnce(document()).mockResolvedValue(old);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'notices', revision: 2}});
  const api = fakeLlpApi({settings: {get, edit}});
  await saveNoticeEdit(api, {kind: 'add', item});
  expect(edit).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      value: {...document().value, sets: [{...item, name: '공지'}]},
    }),
  );
  await saveNoticeEdit(api, {
    kind: 'update',
    id: item.id,
    changes: {interval: 12},
  });
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      value: {
        ...old.value,
        sets: [{...raw, name: '이전', future: 'kept', interval: 12}],
      },
    }),
  );
  await saveNoticeEdit(api, {kind: 'delete', id: item.id});
  expect(edit).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({value: {...old.value, sets: []}}),
  );
});

it('keeps the write pending through a deferred read and retries against the latest set', async () => {
  const read = deferred<ReturnType<typeof document>>();
  const newer = document([{...raw, loop: false, future: 'new'}], 2);
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
    .mockResolvedValue({ok: true, value: {id: 'notices', revision: 3}});
  const api = fakeLlpApi({settings: {get, edit}});
  const writing = saveNoticeEdit(api, {
    kind: 'update',
    id: item.id,
    changes: {interval: 15},
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
        sets: [
          {...raw, name: '공지', loop: false, future: 'new', interval: 15},
        ],
      },
    }),
  );
});

it('reports invalid playback settings and returns applied persistence failures', async () => {
  expect(noticeReason({...item, media: []})).toBeDefined();
  expect(noticeReason({...item, targets: []})).toBeDefined();
  expect(noticeReason({...item, interval: 0})).toBeDefined();
  const failure = {
    ok: false,
    error: {reason: 'write-failed', message: 'disk'},
  } as const;
  const edit = vi.fn().mockResolvedValue(failure);
  const api = fakeLlpApi({settings: {get: async () => document(), edit}});
  await expect(saveNoticeEdit(api, {kind: 'add', item})).resolves.toEqual(
    failure,
  );
  await expect(
    saveNoticeEdit(api, {kind: 'add', item: {...item, interval: 0}}),
  ).rejects.toThrow('Invalid notice');
});
