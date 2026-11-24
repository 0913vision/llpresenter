import type {MediaItem} from '@core/schema/media/mediaList';
import type {ServiceItem} from '@core/schema/services/service';
import {mediaItem} from '@core/slides';
import {slideMaking} from '@renderer/platform/themes';
import {mediaName} from './mediaEntries';

/** A file of the media list as an item. */
export function newMediaItem(media: MediaItem): ServiceItem {
  return mediaItem(slideMaking(), media.id, {
    name: mediaName(media),
    sound: media.kind === 'audio',
  });
}
