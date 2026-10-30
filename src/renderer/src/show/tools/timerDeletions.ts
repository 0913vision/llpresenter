import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/contentEdit';
import type {TimerDelete} from '@core/schema/timerDeletion';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';

export async function deleteTimer(
  api: LlpApi,
  edit: TimerDelete,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => api.settings.edit(edit),
    refused: null,
    sent: result =>
      result !== null && (result.ok || result.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Timer edits stopped for closing');
  return result;
}
