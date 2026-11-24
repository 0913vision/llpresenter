import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {checkPart} from '@core/schema/fileFormat';
import {songSchema} from '@core/schema/song';
import {isItemOfKind} from '@core/schema/service';
import type {ContentCommandContext} from './contentCommands';

type SongItemEdit = Extract<ContentEdit, {type: `service.song.${string}`}>;

/** Explicit library transfers never propagate to other service items. */
export async function transferSongItem(
  context: ContentCommandContext,
  edit: SongItemEdit,
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
  if (edit.type === 'service.song.reloadFromLibrary') {
    const full = context.savesFull([service.file]);
    if (full !== null) return full;
    const updated = context.services.replace(service, {
      ...service.data,
      order: service.data.order.map(row =>
        row === item
          ? {...item, slides: structuredClone(source.data.slides)}
          : row,
      ),
    });
    context.announceService(updated.data.id);
    return context.answer({id: updated.data.id, revision: updated.revision}, [
      await context.write(context.kinds.service, updated),
    ]);
  }
  const writable = context.checkEditable(source);
  if (!writable.ok) return writable.error;
  const validated = checkPart(songSchema, {
    ...source.data,
    slides: structuredClone(item.slides),
    updatedAt: context.now(),
  });
  if (!validated.ok) return context.refuse('invalid', validated.error.message);
  const full = context.savesFull([source.file]);
  if (full !== null) return full;
  const updated = context.songs.replace(source, validated.value);
  context.announceSong(updated.data.id);
  return context.answer({id: updated.data.id, revision: updated.revision}, [
    await context.write(context.kinds.song, updated),
  ]);
}
