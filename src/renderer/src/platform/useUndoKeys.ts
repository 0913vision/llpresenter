import type {RefObject} from 'react';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {Notice} from '@renderer/ui/popups/notices';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {logUndoProblem, undoReason, undoTimeline} from './undoTimeline';

/**
 * 실행 취소 and 다시 실행 while the focus is inside `root`, outside a text field:
 * like everywhere, they run the window's latest step back or forward again.
 * For a part that keeps its keys from the workspace, such as a dialog or the
 * 환경설정 window.
 */
export function useUndoKeys(
  /** The part, or a selector of the part, whose keys these are. */
  root: RefObject<HTMLElement | null> | string,
  report: (notice: Notice) => void = logUndoProblem,
): void {
  const inside = (target: EventTarget | null): boolean =>
    typeof root === 'string'
      ? target instanceof Element && target.closest(root) !== null
      : target instanceof Node && root.current?.contains(target) === true;
  useWindowShortcuts(
    (['undo', 'redo'] as const).map(kind => ({
      id: `edit.${kind}`,
      context: 'service',
      when: (event: KeyboardEvent) =>
        inside(event.target) &&
        event.target instanceof Node &&
        !isInTextEntry(event.target),
      unavailable: () => undoReason(kind),
      run: () => undoTimeline.replay(kind, report),
    })),
  );
}
