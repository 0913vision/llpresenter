import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/notices';
import {useToolEditing} from '../tools/useToolEditing';
import {saveQuickEdit} from './quickEdits';

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
      label: '퀵 실행',
      log: 'Could not edit the quick list',
    },
  });
}
