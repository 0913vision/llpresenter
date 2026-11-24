import {randomUUID} from 'node:crypto';
import {createServiceItemId, type ServiceItemId} from '@core/schema/common/ids';
import {isItemOfKind, type ServiceItem} from '@core/schema/services/service';

export {normalizeSongTitle} from '@core/songs';

/** A fresh version 4 id, checked against the schema of its kind. */
export function newItemId(): ServiceItemId {
  return createServiceItemId(randomUUID());
}

/** Copies items with new ids, so a copy never shares an id with its source. */
export function copiedItems(
  items: readonly ServiceItem[],
): readonly ServiceItem[] {
  return items.map(item => ({...item, id: newItemId()}));
}

/** Includes each selected child's header and keeps the source order (05). */
export function pickedItems(
  items: readonly ServiceItem[],
  wanted: ReadonlySet<string>,
): readonly ServiceItem[] {
  const selected = new Set(wanted);
  let header: ServiceItem | undefined;
  for (const item of items) {
    if (isItemOfKind(item, 'header')) {
      header = item;
    } else if (wanted.has(item.id) && header !== undefined) {
      selected.add(header.id);
    }
  }
  return items.filter(({id}) => selected.has(id));
}
