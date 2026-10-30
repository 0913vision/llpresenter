import {expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {propReason, savePropEdit} from './propEdits';

const rawProp = {
  id: '00000000-0000-4000-8000-000000000001',
  name: ' 로고 ',
  content: {kind: 'image', media: '00000000-0000-4000-8000-000000000002'},
  targets: ['00000000-0000-4000-8000-000000000003'],
};
function document(props: readonly object[] = [], revision = 1) {
  const result = parseSettingsDocument({
    name: 'props',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.props',
      schemaVersion: 1,
      props,
      future: 'kept',
    },
  });
  if (!result.ok || result.value.name !== 'props') {
    throw new Error('Invalid fixture');
  }
  return result.value;
}
const prop = document([rawProp]).value.props[0];
if (!prop) {
  throw new Error('Missing prop fixture');
}
const id = prop.id;

it('adds, updates and deletes without losing unknown fields', async () => {
  const old = document([
    {
      ...prop,
      name: '이전',
      content: {...prop.content, future: 'nested'},
      future: 'kept',
    },
  ]);
  const get = vi.fn().mockResolvedValueOnce(document()).mockResolvedValue(old);
  const edit = vi
    .fn()
    .mockResolvedValue({ok: true, value: {id: 'props', revision: 2}});
  const api = fakeLlpApi({settings: {get, edit}});
  await savePropEdit(api, {kind: 'add', prop});
  expect(edit).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      value: {
        ...document().value,
        props: [{...prop, name: '로고'}],
      },
    }),
  );
  await savePropEdit(api, {kind: 'update', prop});
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      value: {
        ...old.value,
        props: [
          {
            ...prop,
            name: '로고',
            content: {...prop.content, future: 'nested'},
            future: 'kept',
          },
        ],
      },
    }),
  );
  await savePropEdit(api, {kind: 'delete', id});
  expect(edit).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({value: {...old.value, props: []}}),
  );
});

it('waits for a pending read on close and retries a stale revision', async () => {
  const read = deferred<ReturnType<typeof document>>();
  const get = vi
    .fn()
    .mockReturnValueOnce(read.promise)
    .mockResolvedValue(document([], 2));
  const edit = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'stale'},
    })
    .mockResolvedValue({ok: true, value: {id: 'props', revision: 3}});
  const api = fakeLlpApi({settings: {get, edit}});
  const pending = savePropEdit(api, {kind: 'add', prop});
  const gate = pendingWritesOf(api);
  const flush = gate.flush();
  read.resolve(document());
  await pending;
  await flush;
  expect(edit).toHaveBeenCalledTimes(2);
  expect(edit).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({baseRevision: 2}),
  );
});

it('returns a persistence failure as applied and rejects invalid input', async () => {
  const failure = {
    ok: false,
    error: {reason: 'write-failed', message: 'disk'},
  } as const;
  const edit = vi.fn().mockResolvedValue(failure);
  const api = fakeLlpApi({settings: {get: async () => document(), edit}});
  await expect(savePropEdit(api, {kind: 'add', prop})).resolves.toEqual(
    failure,
  );
  expect(propReason({...prop, name: ' '})).toBeDefined();
  expect(propReason({...prop, targets: []})).toBeDefined();
  await expect(
    savePropEdit(api, {kind: 'add', prop: {...prop, name: ''}}),
  ).rejects.toThrow('Invalid prop');
});
