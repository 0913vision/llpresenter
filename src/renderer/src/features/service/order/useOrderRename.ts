import {useState} from 'react';
import type {ServiceRow} from '@core/presentation';
import {createServiceItemId} from '@core/schema/ids';
import {SONG_NAME_MAX_LENGTH} from '@core/schema/song';
import {useHeaderRename} from '@renderer/session/headerRename';
import type {OpenServiceResult} from '@renderer/session/openService';
import {renameItem as renameOrderItem} from '@renderer/session/serviceOrderEdits';
import type {GroupRename} from '@renderer/ui/lists/ListRow';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {isNamed} from './orderRows';

/**
 * The row of the 예배 순서 whose name is being typed in place: chosen from
 * its menu, or a new header asked for from the title row.
 */
export function useOrderRename({
  rows,
  serviceId,
  editable,
  menuOpen,
  save,
}: {
  readonly rows: readonly ServiceRow[];
  readonly serviceId: string | null;
  readonly editable: boolean;
  /** The menu that asks for a rename is open, so the rename waits for it to close. */
  readonly menuOpen: boolean;
  readonly save: (write: () => Promise<OpenServiceResult>) => Promise<boolean>;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const requested = useHeaderRename(state => state.requested);
  const clearRequest = useHeaderRename(state => state.clear);
  const requestedHeader = rows.some(
    row => row.id === requested && row.kind === 'header',
  );
  const stop = (): void => {
    setChosen(null);
    clearRequest();
  };
  const afterMenu = useMenuHandoff<{
    id: string;
    serviceId: string | null;
  }>(menuOpen, target => {
    if (
      target.serviceId === serviceId &&
      editable &&
      rows.some(
        row => row.id === target.id && (row.kind === 'header' || isNamed(row)),
      )
    ) {
      setChosen(target.id);
    }
  });
  return {
    renaming: chosen ?? (requestedHeader ? requested : null),
    /** Opens the name of row `id` for typing. */
    start: setChosen,
    stop,
    afterMenu,
    /** How an item row's name field checks and saves, or none for a row without a name. */
    itemRename: (row: ServiceRow): GroupRename | undefined =>
      isNamed(row)
        ? {
            maxLength: SONG_NAME_MAX_LENGTH,
            onCommit: name =>
              save(() => renameOrderItem(createServiceItemId(row.id), name)),
            onClose: stop,
          }
        : undefined,
  };
}
