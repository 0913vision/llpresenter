import type {MediaId} from '@shared/schema/ids';
import {isItemOfKind} from '@shared/schema/service';
import {
  updateServiceItem,
  type ServiceItemApi,
  type ServiceItemEditResult,
} from './serviceItemUpdate';

interface BackgroundChange {
  readonly serviceId: string;
  readonly itemId: string;
  readonly mediaId: MediaId | null;
}

/** Saves this item's override, or removes it with null to inherit the song default. */
export function updateServiceBackground(
  api: ServiceItemApi,
  {serviceId, itemId, mediaId}: BackgroundChange,
): Promise<ServiceItemEditResult> {
  return updateServiceItem(api, {
    serviceId,
    itemId,
    change: item => {
      if (!isItemOfKind(item, 'song')) return null;
      if ((item.background ?? null) === mediaId) return item;
      const updated = {...item};
      if (mediaId === null) delete updated.background;
      else updated.background = mediaId;
      return updated;
    },
  });
}
