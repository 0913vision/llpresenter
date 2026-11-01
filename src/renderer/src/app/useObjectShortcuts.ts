import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/notices';
import {useToolObjectShortcuts} from '@renderer/features/tools/ToolObjectShortcuts';
import {useQuickObjectShortcuts} from '@renderer/features/quick/QuickObjectShortcuts';

/** Keeps the existing hook entry point while features own their commands. */
export function useObjectShortcuts(
  api: LlpApi | undefined,
  report: (notice: Notice) => void,
): void {
  useToolObjectShortcuts({api, onProblem: report});
  useQuickObjectShortcuts({api, onProblem: report});
}
