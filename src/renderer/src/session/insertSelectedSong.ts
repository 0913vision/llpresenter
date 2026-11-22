import type {LlpApi} from '@contracts/ipc/api';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {createServiceItemId, type SongId} from '@core/schema/ids';
import type {OpenServiceResult} from './openService';
import {insertSong} from './serviceOrderEdits';
import {useShow} from './showStore';

/** Inserts a library song at the current order selection. */
export function insertSelectedSong(
  api: Pick<LlpApi, 'songs'>,
  songId: SongId,
): Promise<OpenServiceResult> {
  const {rows, openItemId} = useShow.getState();
  const before = quickAddBefore(rows, openItemId);
  return insertSong(
    api,
    songId,
    before === null ? null : createServiceItemId(before),
  );
}
