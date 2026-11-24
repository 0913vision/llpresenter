import {useMemo} from 'react';
import type {ServiceRow} from '@core/presentation';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useShow} from '@renderer/session/show';
import {useShownItemId} from '@renderer/session/shownItem';
import {useVisibleSlideItem} from '@renderer/session/visibleSlideItem';
import type {Notice} from '@renderer/ui/popups/notices';
import type {Workspace} from '@renderer/ui/lists/workspace';
import {itemNumbers} from './orderRows';
import {useLiveItemId} from './useLiveItemId';

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
  workspace: Workspace,
  onProblem: (notice: Notice) => void,
) {
  const rows = useShow(view => view.rows);
  const numbers = useMemo(() => itemNumbers(rows), [rows]);
  const openItemId = useShownItemId();
  const liveItemId = useLiveItemId();
  const visibleSlideItem = useVisibleSlideItem();
  const show = useSettingsDocument('preferences', '환경설정', onProblem)?.value
    .show;
  // NOTE(0913vision): With one grid of every item, the list points at the item
  // whose slides are in view rather than the one opened.
  const pointedItemId =
    workspace === 'show' && show?.continuousGrid === true
      ? visibleSlideItem
      : openItemId;
  const dimPast = show?.dimPastItems === true;
  const done = useMemo(
    () => pastItems(rows, dimPast ? liveItemId : null),
    [rows, liveItemId, dimPast],
  );
  return {rows, numbers, openItemId, liveItemId, pointedItemId, done};
}
