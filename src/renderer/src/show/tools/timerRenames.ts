import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import type {TimerRename} from '@shared/schema/timerEdit';
import {pendingWritesOf} from '@renderer/state/pendingWrites';

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
