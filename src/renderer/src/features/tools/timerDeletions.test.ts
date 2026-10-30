import {expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {createTimerId} from '@core/schema/ids';
import type {EditResult} from '@core/schema/contentEdit';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {deferred} from '../quick/quickTesting';
import {deleteTimer} from './timerDeletions';

const edit = {
  type: 'timer.delete',
  name: 'timers',
  timerId: createTimerId('00000000-0000-4000-8000-000000000001'),
} as const;
it.each([true, false])(
  'holds close through deletion and reports applied=%s',
  async applied => {
    const response = deferred<EditResult>();
    const send = vi.fn().mockReturnValue(response.promise);
    const api = fakeLlpApi({settings: {edit: send}});
    const saving = deleteTimer(api, edit);
    let closed = false;
    const closing = pendingWritesOf(api)
      .flush()
      .then(ok => {
        closed = true;
        return ok;
      });
    await Promise.resolve();
    expect(closed).toBe(false);
    response.resolve(
      applied
        ? {
            ok: false,
            error: {
              reason: 'write-failed',
              message: 'Fixture disk',
              applied: {id: edit.timerId, revision: 2},
              unchangedFiles: ['timers.json'],
            },
          }
        : {ok: false, error: {reason: 'read-only', message: 'Fixture access'}},
    );
    await saving;
    expect(await closing).toBe(applied);
    await expect(deleteTimer(api, edit)).rejects.toThrow('stopped for closing');
    expect(send).toHaveBeenCalledExactlyOnceWith(edit);
  },
);
