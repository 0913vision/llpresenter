import {expect, it, onTestFinished, vi} from 'vitest';
import type {AppFlushRequest} from '@core/schema/appFlush';
import {createAppFlushRequestId} from '@core/schema/ids';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@renderer/features/service/items/itemFixture';
import {ControlSession} from './controlSession';

it('refuses close after a memo reaches main but cannot be saved to disk, then retries', async () => {
  const {api} = itemFixture();
  let request: (value: AppFlushRequest) => void = () => undefined;
  vi.spyOn(api.app, 'subscribeFlushRequests').mockImplementation(listener => {
    request = listener;
    return () => undefined;
  });
  const flushDone = vi.spyOn(api.app, 'flushDone');
  const save = vi.spyOn(api.app, 'savePending').mockResolvedValue(false);
  const edit = vi.spyOn(api.content, 'edit');
  const session = new ControlSession(api);
  onTestFinished(() => session.dispose());
  session.startEditor();
  const items = session.items;
  if (items === undefined) throw new Error('Missing item store');
  const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
  items.show(target);
  await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  expect(items.typeMemo(target, 'Newest unsent memo')).toBe(true);
  const requestId = createAppFlushRequestId(
    '00000000-0000-4000-8000-000000000001',
  );
  request({requestId});
  await vi.waitFor(() =>
    expect(session.closeFlush?.getSnapshot()).toBe('failed'),
  );
  expect(flushDone).toHaveBeenLastCalledWith({requestId, result: false});
  expect(save.mock.invocationCallOrder[0]).toBeGreaterThan(
    edit.mock.invocationCallOrder[0] ?? Infinity,
  );
  expect(items.getSnapshot().busy).toBe(false);
  expect(
    (await api.services.get(fixtureServiceId))?.service.order,
  ).toContainEqual(
    expect.objectContaining({id: target.itemId, memo: 'Newest unsent memo'}),
  );
  save.mockResolvedValue(true);
  session.closeFlush?.retry();
  request({requestId});
  await vi.waitFor(() =>
    expect(flushDone).toHaveBeenLastCalledWith({requestId, result: true}),
  );
  expect(items.getSnapshot().busy).toBe(true);
  expect(edit).toHaveBeenCalledOnce();
});

it('refuses close and resumes editing when the disk save call rejects', async () => {
  let request: (value: AppFlushRequest) => void = () => undefined;
  const api = mockLlpApi({
    app: {
      subscribeFlushRequests: listener => {
        request = listener;
        return () => undefined;
      },
      savePending: () => Promise.reject(new Error('Disk save unavailable')),
    },
  });
  const flushDone = vi.spyOn(api.app, 'flushDone');
  const session = new ControlSession(api);
  onTestFinished(() => session.dispose());
  const requestId = createAppFlushRequestId(
    '00000000-0000-4000-8000-000000000001',
  );
  request({requestId});
  await vi.waitFor(() =>
    expect(session.closeFlush?.getSnapshot()).toBe('failed'),
  );
  expect(flushDone).toHaveBeenLastCalledWith({requestId, result: false});
  session.startEditor();
  expect(session.editor).toBeDefined();
});

it('answers a close flush without an editor and starts none after it', async () => {
  let request: (value: AppFlushRequest) => void = () => undefined;
  const flushDone = vi.fn();
  const api = mockLlpApi({
    app: {
      subscribeFlushRequests: listener => {
        request = listener;
        return () => undefined;
      },
      flushDone,
    },
  });
  const session = new ControlSession(api);
  const requestId = createAppFlushRequestId(
    'e85c4096-bc53-4e6f-8a71-829304152637',
  );
  request({requestId});
  await vi.waitFor(() => {
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: true,
    });
  });
  session.startEditor();
  expect(session.editor).toBeUndefined();
  await session.dispose();
});

it('answers a close flush only after a running item edit is sent, and refuses item edits after it', async () => {
  const fixture = itemFixture();
  const {api} = fixture;
  let request: (value: AppFlushRequest) => void = () => undefined;
  vi.spyOn(api.app, 'subscribeFlushRequests').mockImplementation(listener => {
    request = listener;
    return () => undefined;
  });
  const flushDone = vi.spyOn(api.app, 'flushDone');
  const edit = vi.spyOn(api.content, 'edit');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const session = new ControlSession(api);
  session.startEditor();
  const items = session.items;
  if (items === undefined) throw new Error('Missing item store');
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  const read = api.services.get.bind(api.services);
  let answer: () => void = () => undefined;
  vi.spyOn(api.services, 'get').mockImplementationOnce(
    id =>
      new Promise(resolve => {
        answer = () => {
          resolve(read(id));
        };
      }),
  );
  const choosing = items.chooseArrangement(undefined);
  const requestId = createAppFlushRequestId(
    'a07e61b8-de75-4081-8c93-041526374859',
  );
  request({requestId});
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
  expect(flushDone).not.toHaveBeenCalled();
  answer();
  await vi.waitFor(() => {
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: true,
    });
  });
  expect(await choosing).toBe(true);
  expect(edit.mock.invocationCallOrder.at(-1)).toBeLessThan(
    flushDone.mock.invocationCallOrder[0] ?? -Infinity,
  );
  expect(items.getSnapshot().busy).toBe(true);
  expect(await items.chooseArrangement('주일용')).toBe(false);
  expect(edit).toHaveBeenCalledOnce();
  await session.dispose();
});

it('restarts item edits when the editor refuses the close flush', async () => {
  const {api} = itemFixture();
  let request: (value: AppFlushRequest) => void = () => undefined;
  vi.spyOn(api.app, 'subscribeFlushRequests').mockImplementation(listener => {
    request = listener;
    return () => undefined;
  });
  const flushDone = vi.spyOn(api.app, 'flushDone');
  const session = new ControlSession(api);
  session.startEditor();
  const {items, editor} = session;
  if (items === undefined || editor === undefined) {
    throw new Error('Missing stores');
  }
  vi.spyOn(editor, 'flush').mockResolvedValue(false);
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  const requestId = createAppFlushRequestId(
    'b18f72c9-ef86-4192-9da4-152637485960',
  );
  request({requestId});
  await vi.waitFor(() => {
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: false,
    });
  });
  expect(items.getSnapshot().busy).toBe(false);
  expect(await items.chooseArrangement('주일용')).toBe(true);
  await session.dispose();
});

it('refuses the close when a pending item read rejects while the editor flush succeeds, and resumes both', async () => {
  const {api} = itemFixture();
  let request: (value: AppFlushRequest) => void = () => undefined;
  vi.spyOn(api.app, 'subscribeFlushRequests').mockImplementation(listener => {
    request = listener;
    return () => undefined;
  });
  const flushDone = vi.spyOn(api.app, 'flushDone');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const session = new ControlSession(api);
  session.startEditor();
  const {items, editor} = session;
  if (items === undefined || editor === undefined) {
    throw new Error('Missing stores');
  }
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
  let fail: () => void = () => undefined;
  vi.spyOn(api.services, 'get').mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = () => {
          reject(new Error('Invented read failure'));
        };
      }),
  );
  const choosing = items.chooseArrangement(undefined);
  const requestId = createAppFlushRequestId(
    'c29a83da-f097-41a3-8eb5-263748596071',
  );
  request({requestId});
  await vi.waitFor(() => expect(editor.getSnapshot().busy).toBe(true));
  fail();
  await vi.waitFor(() => {
    expect(flushDone).toHaveBeenCalledExactlyOnceWith({
      requestId,
      result: false,
    });
  });
  expect(await choosing).toBe(false);
  expect(items.getSnapshot().busy).toBe(false);
  expect(editor.getSnapshot().busy).toBe(false);
  expect(await items.chooseArrangement('주일용')).toBe(true);
  await session.dispose();
});

it('refuses the close while a refused memo waits, and lets it close after a retry saves it', async () => {
  const {api, service} = itemFixture();
  let request: (value: AppFlushRequest) => void = () => undefined;
  vi.spyOn(api.app, 'subscribeFlushRequests').mockImplementation(listener => {
    request = listener;
    return () => undefined;
  });
  const flushDone = vi.spyOn(api.app, 'flushDone');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const write = api.content.edit;
  const edit = vi.spyOn(api.content, 'edit').mockResolvedValue({
    ok: false,
    error: {reason: 'stale', message: 'Fixture refusal'},
  });
  const session = new ControlSession(api);
  session.startEditor();
  const items = session.items;
  if (items === undefined) throw new Error('Missing item store');
  items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
  await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
  const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
  expect(await items.setMemo(target, '닫기 전의 글')).toBe(false);
  const first = createAppFlushRequestId('c29f83da-f097-4203-8eb5-263748596071');
  request({requestId: first});
  await vi.waitFor(() => {
    expect(flushDone).toHaveBeenCalledWith({requestId: first, result: false});
  });
  expect(items.memoDraft(target)).toBe('닫기 전의 글');
  edit.mockImplementation(write);
  const second = createAppFlushRequestId(
    'd3a094eb-a108-4314-9fc6-374859607182',
  );
  request({requestId: second});
  await vi.waitFor(() => {
    expect(flushDone).toHaveBeenCalledWith({requestId: second, result: true});
  });
  expect(service().service.order[1]).toMatchObject({memo: '닫기 전의 글'});
  await session.dispose();
});
