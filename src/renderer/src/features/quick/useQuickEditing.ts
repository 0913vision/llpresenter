import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/popups/notices';
import {useToolEditing} from '../tools/useToolEditing';
import {saveQuickEdit} from './quickEdits';

/**
 * Saves edits of the 빠른 실행 document, and reports a problem with `onProblem`.
 */
export function useQuickEditing(
  api: LlpApi | undefined,
  onProblem: (notice: Notice) => void,
) {
  return useToolEditing({
    api,
    write: saveQuickEdit,
    onProblem,
    area: {
      key: 'quick',
      label: '빠른 실행',
      log: 'Could not edit the quick list',
    },
  });
}
