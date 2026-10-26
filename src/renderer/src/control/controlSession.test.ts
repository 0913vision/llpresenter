import {expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@shared/schema/appFlush';
import {createAppFlushRequestId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
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
