import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {mediaItem} from '@core/slides';
import {slideMaking} from '@renderer/platform/themes';
import {mediaName} from './backgroundChoices';

/** A file of the media list as an item. */
export function newMediaItem(media: MediaItem): ServiceItem {
  return mediaItem(slideMaking(), media.id, {
    name: mediaName(media),
    sound: media.kind === 'audio',
  });
}
