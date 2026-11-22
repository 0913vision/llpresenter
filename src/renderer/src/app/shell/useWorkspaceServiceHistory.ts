import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {runEdit} from '@renderer/session/serviceEdit';
import {
  redoService,
  undoService,
  useOpenService,
} from '@renderer/session/openService';
import type {Notice} from '@renderer/ui/notices';
import {isTextField} from '@renderer/ui/commandDispatcher';

/** Keeps service edits reachable when focus moves from an editor to a slide. */
export function useWorkspaceServiceHistory(
  active: boolean,
  onProblem: (notice: Notice) => void,
): void {
  const open = useOpenService(view => view.service !== null && !view.readOnly);
  const canUndo = useOpenService(view => view.past.length > 0);
  const canRedo = useOpenService(view => view.future.length > 0);
  const ownsHistory = (event: KeyboardEvent): boolean =>
    active && open && !isTextField(event);
  useWindowShortcuts([
    {
      id: 'edit.undo',
      context: 'service',
      fallback: true,
      when: ownsHistory,
      unavailable: () => (canUndo ? undefined : NOTHING_TO_UNDO),
      run: () => runEdit(undoService(), onProblem),
    },
    {
      id: 'edit.redo',
      context: 'service',
      fallback: true,
      when: ownsHistory,
      unavailable: () => (canRedo ? undefined : NOTHING_TO_REDO),
      run: () => runEdit(redoService(), onProblem),
    },
  ]);
}
