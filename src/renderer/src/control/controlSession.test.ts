import {expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@shared/schema/appFlush';
import {createAppFlushRequestId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@renderer/prep/service/itemFixture';
import {ControlSession} from './controlSession';

it('answers a close flush without an editor and starts none after it', async () => {
  let request: (value: AppFlushRequest) => void = () => undefined;
  const flushDone = vi.fn();
  const api = fakeLlpApi({
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
