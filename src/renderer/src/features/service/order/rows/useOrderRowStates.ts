import {useMemo, useSyncExternalStore} from 'react';
import type {ServiceRow} from '@core/presentation';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {useShownItemId} from '@renderer/session/show/shownItem';
import {
  usePickedSlideItem,
  useVisibleSlideItem,
} from '@renderer/session/show/visibleSlideItem';
import {liveReturn} from '@renderer/features/presentation/grid/liveReturn';
import {pointedItem} from './pointedItem';
import type {Notice} from '@renderer/ui/popups/notices';
import type {ListWorkspace} from '@renderer/ui/lists/workspace';
import {itemNumbers} from '../orderRows';
import {useLiveItemId} from './useLiveItemId';
import {useShow} from '@renderer/session/show/showStore';

/** The items above the live one, which 지난 순서 흐리게 dims. */
function pastItems(
  rows: readonly ServiceRow[],
  liveItemId: string | null,
): ReadonlySet<string> {
  const live = rows.findIndex(row => row.id === liveItemId);
  return new Set(rows.slice(0, Math.max(0, live)).map(row => row.id));
}

/**
 * What the rows of the 예배 순서 show besides their names: their numbers, the
 * item on the screens, the item the list points at, and the items that are
 * past.
 */
export function useOrderRowStates(
  workspace: ListWorkspace,
  onProblem: (notice: Notice) => void,
) {
  const rows = useShow(view => view.rows);
  const numbers = useMemo(() => itemNumbers(rows), [rows]);
  const openItemId = useShownItemId();
  const liveItemId = useLiveItemId();
  const visibleSlideItem = useVisibleSlideItem();
  const picked = usePickedSlideItem();
  const liveInSight =
    useSyncExternalStore(liveReturn.subscribe, liveReturn.get) === 'here';
  const show = useSettingsDocument('preferences', '환경설정', onProblem)?.value
    .show;
  // NOTE(0913vision): With one grid of every item, the list points at the item
  // in view, leaning to the live one while its slide is in sight.
  const pointedItemId =
    workspace === 'show' && show?.continuousGrid === true
      ? pointedItem({
          picked,
          liveItemId,
          liveInSight,
          topItemId: visibleSlideItem,
        })
      : openItemId;
  const dimPast = show?.dimPastItems === true;
  const done = useMemo(
    () => pastItems(rows, dimPast ? liveItemId : null),
    [rows, liveItemId, dimPast],
  );
  return {rows, numbers, openItemId, liveItemId, pointedItemId, done};
}
