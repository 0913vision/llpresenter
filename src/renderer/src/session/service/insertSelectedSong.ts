import type {LlpApi} from '@contracts/ipc/api';
import {quickAddBefore} from '@core/services';
import {createServiceItemId, type SongId} from '@core/schema/common/ids';
import type {OpenServiceResult} from './openService';
import {insertSong} from './serviceOrderEdits';
import {orderSelectionId} from '../show/orderSelection';
import {useShow} from '../show/showStore';

/** Inserts a library song after the 예배 순서 row chosen last. */
export function insertSelectedSong(
  api: Pick<LlpApi, 'songs'>,
  songId: SongId,
): Promise<OpenServiceResult> {
  const before = quickAddBefore(useShow.getState().rows, orderSelectionId());
  return insertSong(
    api,
    songId,
    before === null ? null : createServiceItemId(before),
  );
}
