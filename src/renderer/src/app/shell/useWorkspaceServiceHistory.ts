import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {undoReason, undoTimeline} from '@renderer/platform/undoTimeline';
import type {Notice} from '@renderer/ui/popups/notices';
import {isTextField} from '@renderer/ui/keys/commandDispatcher';

/**
 * 실행 취소 and 다시 실행 of the workspace: wherever the focus is, outside a
 * text field and an editor with its own history, they run the latest step of
 * the window back or forward again, as in PowerPoint.
 */
export function useWorkspaceServiceHistory(
  active: boolean,
  onProblem: (notice: Notice) => void,
): void {
  const owns = (event: KeyboardEvent): boolean => active && !isTextField(event);
  useWindowShortcuts(
    (['undo', 'redo'] as const).map(kind => ({
      id: `edit.${kind}`,
      context: 'service',
      fallback: true,
      when: owns,
      unavailable: () => undoReason(kind),
      run: () => undoTimeline.replay(kind, onProblem),
    })),
  );
}
