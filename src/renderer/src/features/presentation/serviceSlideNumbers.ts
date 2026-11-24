import type {TileCursor} from '@core/presentation';
import {tilesForView} from '@renderer/session/show/showLibrary';
import type {ShowView} from '@renderer/session/show/showStore';

/** A service number counts exactly the tiles in service order, including cards. */
export function serviceSlideOffset(
  view: ShowView,
  itemId: string,
): number | null {
  let count = 0;
  for (const row of view.rows) {
    if (row.kind === 'header') continue;
    if (row.id === itemId) return count;
    count += tilesForView(view, row.id).length;
  }
  return null;
}

/**
 * The tile that is slide `number` of the service, counting from 1 through the
 * order, or null when there is none.
 */
export function serviceSlideAt(
  view: ShowView,
  number: number,
): TileCursor | null {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  let remaining = number;
  for (const row of view.rows) {
    if (row.kind === 'header') continue;
    const count = tilesForView(view, row.id).length;
    if (remaining <= count) return {itemId: row.id, index: remaining - 1};
    remaining -= count;
  }
  return null;
}
