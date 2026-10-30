import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/contentEdit';
import type {TimerRename} from '@core/schema/timerEdit';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';

export async function renameTimer(
  api: LlpApi,
  edit: TimerRename,
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
