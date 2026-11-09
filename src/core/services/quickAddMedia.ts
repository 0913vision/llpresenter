import {createServiceItemId, type MediaId} from '../schema/ids';
import type {ServiceItem} from '../schema/service';

/** Creates the same media item for service-order adders. */
export function newMediaItem(media: MediaId): ServiceItem {
  return {id: createServiceItemId(crypto.randomUUID()), media};
}
