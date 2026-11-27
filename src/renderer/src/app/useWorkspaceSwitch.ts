import {useEffect, useMemo, useRef, useState} from 'react';
import {ThemeLeaveGuard} from '@renderer/features/screens/themes/saving/themeLeaveGuard';
import {usePrepTarget} from '@renderer/session/prepTarget';
import {WorkspaceSelections} from '@renderer/session/show/workspaceSelections';
import type {Workspace as WorkspaceId} from '@renderer/platform/WorkspaceNavigation';
import {useShow} from '@renderer/session/show/showStore';
import {useLive} from '@renderer/session/live';

/**
 * Which workspace the window shows, and the switch between them. Every
 * workspace stays built, so a switch only hides one and shows another, in the
 * same frame (USER Nov 21, Nov 27): a song open in 라이브러리 stays open, as an
 * item open in 준비 does. Only a theme changed in 테마 is asked about first. A
 * request to open something in 준비 or 라이브러리 moves there.
 */
export function useWorkspaceSwitch() {
  const [workspace, setWorkspace] = useState<WorkspaceId>('show');
  const requestedItem = useShow(view => view.openItemId);
  const prepTarget = usePrepTarget(view => view.target);
  const shownFrame = useMemo(
    () => ({workspace, item: requestedItem, prep: prepTarget}),
    [workspace, requestedItem, prepTarget],
  );
  const [savedPrepItem, setSavedPrepItem] = useState<string | null>(null);
  const [workspaceSelections] = useState(() => new WorkspaceSelections());
  const [themeLeave] = useState(() => new ThemeLeaveGuard());
  useEffect(
    () =>
      useLive.subscribe((next, previous) => {
        const item = next.state?.item;
        if (
          item?.source === 'service' &&
          item.id !== previous.state?.item?.id
        ) {
          workspaceSelections.followLive(item.id);
        }
      }),
    [workspaceSelections],
  );

  const switchTo = (next: WorkspaceId): void => {
    const go = (): void => {
      if (shownFrame.workspace === 'prep' && next !== 'prep') {
        setSavedPrepItem(shownFrame.item);
      }
      workspaceSelections.activate(next);
      setWorkspace(next);
    };
    if (workspace === 'screens' && next !== 'screens') {
      themeLeave.leave(go);
    } else go();
  };

  const prepRequest = usePrepTarget(view => view.request);
  const requested = usePrepTarget(view => view.requested);
  const answered = useRef(prepRequest);
  useEffect(() => {
    if (answered.current === prepRequest) return;
    answered.current = prepRequest;
    if (workspace !== requested) switchTo(requested);
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
