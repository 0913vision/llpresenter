import {useState} from 'react';
import type {ServiceRow} from '@core/presentation';
import type {Notice} from '@renderer/ui/popups/notices';
import {rowsOfMenu} from '../orderRows';
import type {useServiceItemSelection} from '../useServiceItemSelection';
import {useServiceSongMenu} from './useServiceSongMenu';
import type {MenuAnchor} from '@renderer/ui/menus/menuModel';

interface OpenOrderMenu {
  readonly id: string;
  readonly serviceId: string | null;
  readonly anchor: MenuAnchor;
}

/**
 * The item menu of the 예배 순서: which row it is open on, and the song it
 * reads for a song row. A menu of another service is closed.
 */
export function useOrderMenu({
  rows,
  serviceId,
  selection,
  onProblem,
}: {
  readonly rows: readonly ServiceRow[];
  readonly serviceId: string | null;
  readonly selection: ReturnType<typeof useServiceItemSelection>;
  readonly onProblem: (notice: Notice) => void;
}) {
  const [opened, setOpened] = useState<OpenOrderMenu | null>(null);
  const menu = opened?.serviceId === serviceId ? opened : null;
  const row = rows.find(entry => entry.id === menu?.id);
  const songMenu = useServiceSongMenu(
    row?.kind === 'song' ? menu : null,
    onProblem,
  );
  /** Opens the menu on a row, choosing the row when it is not chosen. */
  const open = (
    id: string,
    list: Element,
    anchor: (targets: readonly HTMLElement[]) => MenuAnchor,
  ): void => {
    if (!selection.selected.has(id)) selection.replace([id], id);
    setOpened({
      id,
      serviceId,
      anchor: anchor(rowsOfMenu(list, id, selection.selected)),
    });
  };
  return {menu, songMenu, open, setMenu: setOpened};
}
