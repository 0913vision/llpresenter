import {useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import type {Workspace as WorkspaceId} from '@renderer/app/shell/toolbar/Toolbar';
import {ThemeLeaveGuard} from '@renderer/features/screens/themes/saving/themeLeaveGuard';
import {requestLeaveSong} from '@renderer/features/songs/songDraft';
import {closePrepEditor, usePrepTarget} from '@renderer/session/prepTarget';
import {useShow} from '@renderer/session/show/show';
import {WorkspaceSelections} from '@renderer/session/show/workspaceSelections';

/**
 * Which workspace the window shows, and the switch between them. A switch
 * first leaves what may not be left silently: a song edited in 준비, a theme
 * changed in 화면. The new workspace draws a moment later than it is asked
 * for, so the click answers at once. A request to open something in 준비
 * moves there.
 */
export function useWorkspaceSwitch() {
  const [workspace, setWorkspace] = useState<WorkspaceId>('show');
  const requestedItem = useShow(view => view.openItemId);
  const prepTarget = usePrepTarget(view => view.target);
  const requestedFrame = useMemo(
    () => ({workspace, item: requestedItem, prep: prepTarget}),
    [workspace, requestedItem, prepTarget],
  );
  const shownFrame = useDeferredValue(requestedFrame);
  const [savedPrepItem, setSavedPrepItem] = useState<string | null>(null);
  const [workspaceSelections] = useState(() => new WorkspaceSelections());
  const [themeLeave] = useState(() => new ThemeLeaveGuard());

  const switchTo = (next: WorkspaceId): void => {
    const go = (): void => {
      if (shownFrame.workspace === 'prep' && next !== 'prep') {
        setSavedPrepItem(shownFrame.item);
      }
      workspaceSelections.activate(next);
      setWorkspace(next);
    };
    const leavingSong =
      workspace === 'prep' && next !== 'prep' && prepTarget?.kind === 'song';
    if (leavingSong) {
      requestLeaveSong(() => {
        closePrepEditor();
        go();
      });
    } else if (workspace === 'screens' && next !== 'screens') {
      themeLeave.leave(go);
    } else go();
  };

  const prepRequest = usePrepTarget(view => view.request);
  const answered = useRef(prepRequest);
  useEffect(() => {
    if (answered.current === prepRequest) return;
    answered.current = prepRequest;
    if (workspace !== 'prep') switchTo('prep');
  });

  return {
    /** The workspace asked for last. */
    workspace,
    /** What the window draws now: a workspace, its item, its 준비 target. */
    shownFrame,
    /** The item 준비 had open when it was left, to show again. */
    savedPrepItem,
    themeLeave,
    switchTo,
  };
}
