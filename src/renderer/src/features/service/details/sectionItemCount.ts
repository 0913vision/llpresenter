import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ServiceItemId} from '@core/schema/ids';

/** Counts items following a section header up to the next header. */
export function sectionItemCount(
  order: readonly ServiceItem[],
  headerId: ServiceItemId,
): number {
  const start = order.findIndex(row => row.id === headerId);
  const header = order[start];
  if (header === undefined || !isItemOfKind(header, 'header')) return 0;
  let count = 0;
  for (const row of order.slice(start + 1)) {
    if (isItemOfKind(row, 'header')) break;
    count += 1;
  }
  return count;
}
