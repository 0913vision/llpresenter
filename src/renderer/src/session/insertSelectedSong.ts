import {quickAddBefore} from '@core/services/quickAddPosition';
import {
  createServiceItemId,
  type ServiceId,
  type SongId,
} from '@core/schema/ids';
import {useShow} from './showStore';
import type {
  ServiceOrderEdits,
  ServiceOrderEditResult,
} from './serviceOrderEdits';

/** Inserts a library song at the current order selection. */
export function insertSelectedSong(
  edits: ServiceOrderEdits,
  serviceId: ServiceId,
  songId: SongId,
): Promise<ServiceOrderEditResult> {
  const {rows, openItemId} = useShow.getState();
  const before = quickAddBefore(rows, openItemId);
  return edits.insertSong(
    serviceId,
    songId,
    before === null ? null : createServiceItemId(before),
  );
}
