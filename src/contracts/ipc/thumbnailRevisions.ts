import {thumbnailRevision} from '@core/media/thumbnailRevision';
import type {MediaItem} from '@core/schema/mediaList';
import {thumbnailUrl} from './mediaUrls';

// NOTE(0913vision): Every picture that draws a thumbnail knows only the media
// id, while the revision comes from the item's file and the time main read for
// it. The media list of this window records both as they arrive, before its
// views draw, so every caller gets the revisioned URL a window can keep. An id
// whose file or time the window has not heard of yet gets the plain URL, which
// still works but asks again.
const items = new Map<string, Pick<MediaItem, 'file' | 'size'>>();
const stamps = new Map<string, number>();

/** Records the files of a media list that has just arrived. */
export function noteThumbnailItems(
  list: ReadonlyArray<Pick<MediaItem, 'id' | 'file' | 'size'>>,
): void {
  items.clear();
  for (const {id, file, size} of list) items.set(id, {file, size});
}

/** Records when each media file was last changed. */
export function noteThumbnailStamps(
  times: Readonly<Record<string, number>>,
): void {
  stamps.clear();
  for (const [id, time] of Object.entries(times)) stamps.set(id, time);
}

/** The URL of a media item's thumbnail, with its revision when it is known. */
export function thumbnailSrc(mediaId: string): string {
  const item = items.get(mediaId);
  const modified = stamps.get(mediaId);
  if (item === undefined || modified === undefined) {
    return thumbnailUrl(mediaId);
  }
  return thumbnailUrl(mediaId, thumbnailRevision({...item, modified}));
}
