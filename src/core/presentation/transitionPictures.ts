import type {ServiceRow, SlideTile, TileCursor} from './model';

/** Enumerates every output tile in service order for background rendering. */
export function servicePicturePlan(
  rows: readonly ServiceRow[],
  tiles: Readonly<Record<string, readonly SlideTile[]>>,
): readonly TileCursor[] {
  const selected: TileCursor[] = [];
  for (const row of rows) {
    if (row.kind === 'header' || row.kind === 'unknown') continue;
    for (let index = 0; index < (tiles[row.id]?.length ?? 0); index += 1) {
      selected.push({itemId: row.id, index});
    }
  }
  return selected;
}
