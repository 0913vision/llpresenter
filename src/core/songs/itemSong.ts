import type {ServiceItemId, SongId} from '../schema/ids';
import {isItemOfKind, type Service, type ServiceItem} from '../schema/service';

/** Switches a song item to another library song, keeping its other fields. */
export function withSong(
  item: ServiceItem,
  songId: SongId,
): ServiceItem | null {
  if (!isItemOfKind(item, 'song')) return null;
  return item.song === songId ? item : {...item, song: songId};
}

/** The 예배 순서 with one song item on another song, or null without that item. */
export function withServiceItemSong(
  service: Service,
  itemId: ServiceItemId,
  songId: SongId,
): Service | null {
  const index = service.order.findIndex(item => item.id === itemId);
  const item = service.order[index];
  const switched = item === undefined ? null : withSong(item, songId);
  if (switched === null) return null;
  return {
    ...service,
    order: service.order.map((entry, at) => (at === index ? switched : entry)),
  };
}
