import type {ContentEdit, EditResult} from '@core/schema/services/contentEdit';
import {songItemSlides} from '@core/slides';
import {closingSongTitleOf, slideMakingOf} from './slideMaking';
import {isItemOfKind} from '@core/schema/services/service';
import type {ContentCommandContext} from './contentCommands';

type SongItemReload = Extract<
  ContentEdit,
  {type: 'service.song.reloadFromLibrary'}
>;

/**
 * 라이브러리에서 다시 불러오기: the item gets the song as a new item would,
 * and no other item changes. A song item goes back to the library only
 * through the song editor (USER Nov 25), never by this store directly.
 */
export async function reloadSongItem(
  context: ContentCommandContext,
  edit: SongItemReload,
): Promise<EditResult> {
  await context.flushAutosave();
  const checked = context.checkEditable(context.services.get(edit.serviceId));
  if (!checked.ok) return checked.error;
  const service = checked.value;
  if (service.revision !== edit.baseRevision) {
    return context.refuse('stale', 'The service changed');
  }
  const item = service.data.order.find(row => row.id === edit.itemId);
  if (item === undefined || !isItemOfKind(item, 'song')) {
    return context.refuse('not-found', 'The song item no longer exists');
  }
  const source = context.songs.get(item.song);
  if (source === undefined) {
    return context.refuse('not-found', 'The library song no longer exists');
  }
  if (source.revision !== edit.songRevision) {
    return context.refuse('stale', 'The library song changed');
  }
  const full = context.savesFull([service.file]);
  if (full !== null) return full;
  const updated = context.services.replace(service, {
    ...service.data,
    order: service.data.order.map(row =>
      row === item
        ? {
            ...item,
            slides: songItemSlides(
              source.data,
              slideMakingOf(context.settings),
              {closingTitle: closingSongTitleOf(context.settings)},
            ),
          }
        : row,
    ),
  });
  context.announceService(updated.data.id);
  return context.answer({id: updated.data.id, revision: updated.revision}, [
    await context.write(context.kinds.service, updated),
  ]);
}
