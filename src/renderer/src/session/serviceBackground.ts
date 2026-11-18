import type {MediaId} from '@core/schema/ids';
import {isStartItem} from '@core/services/itemFieldChanges';
import {pendingWritesOf} from '../platform/pendingWrites';
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

export type ItemBackgroundChoice = MediaId | 'none' | null;

/** Sets a background override, explicit absence, or default inheritance. */
export function backgroundChange(
  choice: ItemBackgroundChoice,
): ServiceItemChange {
  return item => {
    if (!isStartItem(item)) return null;
    if (
      choice === 'none' &&
      item.backgroundNone === true &&
      item.background === undefined
    )
      {return item;}
    if (
      choice === null &&
      item.backgroundNone !== true &&
      item.background === undefined
    )
      {return item;}
    if (
      choice !== null &&
      choice !== 'none' &&
      item.backgroundNone !== true &&
      item.background === choice
    )
      {return item;}
    const {background: _background, backgroundNone: _none, ...updated} = item;
    return choice === 'none'
      ? {...updated, backgroundNone: true}
      : choice === null
        ? updated
        : {...updated, background: choice};
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
