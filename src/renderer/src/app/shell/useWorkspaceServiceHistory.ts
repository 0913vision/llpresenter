import {useCallback, useSyncExternalStore} from 'react';
import {createServiceId} from '@core/schema/ids';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';
import {useShow} from '@renderer/session/showStore';
import {useServiceOrderEditing} from '@renderer/session/useServiceOrderEditing';
import type {Notice} from '@renderer/ui/notices';
import {isInTextEntry} from '@renderer/ui/textEntry';

/** Keeps service edits reachable when focus moves from an editor to a slide. */
export function useWorkspaceServiceHistory(
  active: boolean,
  onProblem: (notice: Notice) => void,
): void {
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const api = window.llp;
  const edits = api === undefined ? undefined : serviceOrderEditsFor(api);
  const id =
    active && !readOnly && serviceId !== null
      ? createServiceId(serviceId)
      : null;
  const editing = useServiceOrderEditing(id, onProblem);
  const subscribe = useCallback(
    (listener: () => void) => edits?.subscribe(listener) ?? (() => undefined),
    [edits],
  );
  const canUndo = useSyncExternalStore(
    subscribe,
    () => id !== null && edits?.canUndo(id) === true,
  );
  const canRedo = useSyncExternalStore(
    subscribe,
    () => id !== null && edits?.canRedo(id) === true,
  );
  const ownsHistory = (event: KeyboardEvent): boolean =>
    id !== null && edits !== undefined && !isInTextEntry(event.target);
  useWindowShortcuts([
    {
      id: 'edit.undo',
      context: 'service',
      fallback: true,
      when: ownsHistory,
      unavailable: () => (canUndo ? undefined : NOTHING_TO_UNDO),
      run: () => editing.run((history, service) => history.undo(service)),
    },
    {
      id: 'edit.redo',
      context: 'service',
      fallback: true,
      when: ownsHistory,
      unavailable: () => (canRedo ? undefined : NOTHING_TO_REDO),
      run: () => editing.run((history, service) => history.redo(service)),
    },
  ]);
}
