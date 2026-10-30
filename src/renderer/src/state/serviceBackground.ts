import type {MediaId} from '@core/schema/ids';
import {isItemOfKind} from '@core/schema/service';
import {pendingWritesOf} from './pendingWrites';
import {
  updateServiceItem,
  type ServiceItemApi,
  type ServiceItemChange,
  type ServiceItemEditResult,
} from './serviceItemUpdate';

interface BackgroundChange {
  readonly serviceId: string;
  readonly itemId: string;
  readonly mediaId: MediaId | null;
}

/** Sets a song item's override, or removes it with null for the song default. */
export function backgroundChange(mediaId: MediaId | null): ServiceItemChange {
  return item => {
    if (!isItemOfKind(item, 'song')) return null;
    if ((item.background ?? null) === mediaId) return item;
    const updated = {...item};
    if (mediaId === null) delete updated.background;
    else updated.background = mediaId;
    return updated;
  };
}

/**
 * Saves this item's override, or removes it with null to inherit the song
 * default, through the window's pending writes, so the close flush waits for
 * it.
 */
export function updateServiceBackground(
  api: ServiceItemApi,
  {serviceId, itemId, mediaId}: BackgroundChange,
): Promise<ServiceItemEditResult> {
  return pendingWritesOf(api).run({
    write: () =>
      updateServiceItem(api, {
        serviceId,
        itemId,
        change: backgroundChange(mediaId),
      }),
    refused: {
      ok: false,
      error: {reason: 'request-failed', message: 'Edits stopped for closing'},
    },
    sent: result => result.ok || result.error.reason === 'write-failed',
  });
}
