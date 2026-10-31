import {expect, it, vi} from 'vitest';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {createTimerId} from '@core/schema/ids';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {deferred} from './testing/quickTesting';
import type {EditResult} from '@core/schema/contentEdit';
import {renameTimer} from './timerRenames';

const edit = {
  type: 'timer.rename',
  name: 'timers',
  timerId: createTimerId('00000000-0000-4000-8000-000000000001'),
  timerName: '설교',
} as const;
it('holds close until a rename reaches main and refuses a later write after close', async () => {
  const result = deferred<EditResult>();
  const send = vi.fn().mockReturnValue(result.promise);
  const api = mockLlpApi({settings: {edit: send}});
  const saving = renameTimer(api, edit);
  let closed = false;
  const closing = pendingWritesOf(api)
    .flush()
    .then(ok => {
      closed = true;
      return ok;
    });
  await Promise.resolve();
  expect(closed).toBe(false);
  result.resolve({
    ok: false,
    error: {
      reason: 'write-failed',
      message: 'Fixture disk',
      applied: {id: edit.timerId, revision: 2},
      unchangedFiles: ['timers.json'],
    },
  });
  await expect(saving).resolves.toMatchObject({
    error: {reason: 'write-failed'},
  });
  expect(await closing).toBe(true);
  await expect(renameTimer(api, edit)).rejects.toThrow('stopped for closing');
  expect(send).toHaveBeenCalledExactlyOnceWith(edit);
});
