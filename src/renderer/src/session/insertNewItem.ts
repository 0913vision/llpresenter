import {
  createServiceItemId,
  type ServiceItemId,
  type SongId,
} from '@core/schema/common/ids';
import {hasSlides, type ServiceItem} from '@core/schema/services/service';
import {quickAddBefore} from '@core/services';
import {useHeaderRename} from './headerRename';
import {insertItem, insertSong} from './serviceOrderEdits';
import {openInPrep} from './prepTarget';
import {rememberBiblePassage} from './recentWriter';
import {runEdit, type Report} from './serviceEdit';
import {useShow} from './showStore';

/** The row a new item goes in front of: after the selected one. */
export function rowAfterSelected(): ServiceItemId | null {
  const {rows, openItemId} = useShow.getState();
  const before = quickAddBefore(rows, openItemId);
  return before === null ? null : createServiceItemId(before);
}

/** Puts a new item in the 예배 순서, and opens the ones that start empty. */
export function insertNewItem(
  item: ServiceItem,
  before: ServiceItemId | null,
  {
    report,
    edit = false,
  }: {
    readonly report: Report;
    /** Opens the item in 준비 to be filled in. */
    readonly edit?: boolean;
  },
): void {
  if (item.kind === 'header') useHeaderRename.getState().request(item.id);
  const done = insertItem(item, before).then(result => {
    if (!result.ok && result.error.reason !== 'write-failed') return result;
    if (hasSlides(item) && 'passage' in item) {
      rememberBiblePassage({
        ref: item.passage.ref,
        translation: item.passage.translation,
      });
    }
    if (edit) openInPrep({kind: 'item', itemId: item.id});
    return result;
  });
  runEdit(done, report);
}

/** Puts a library song in the 예배 순서. */
export function insertLibrarySong(
  songId: SongId,
  before: ServiceItemId | null,
  report: Report,
): void {
  const api = window.llp;
  if (api !== undefined) runEdit(insertSong(api, songId, before), report);
}
