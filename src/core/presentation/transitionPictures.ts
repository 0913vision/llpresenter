import type {ServiceRow, SlideTile, TileCursor} from './model';

function addTransition(
  selected: Map<string, TileCursor>,
  tile: SlideTile,
  {
    current,
    previous,
  }: {readonly current: TileCursor; readonly previous: TileCursor | undefined},
): void {
  if (tile.transition === undefined || tile.transition.kind === 'none') return;
  if (previous !== undefined) selected.set(JSON.stringify(previous), previous);
  selected.set(JSON.stringify(current), current);
}

/** Slides with an effect and their immediate predecessors need cached pictures. */
export function transitionPicturePlan(
  rows: readonly ServiceRow[],
  tiles: Readonly<Record<string, readonly SlideTile[]>>,
): readonly TileCursor[] {
  const selected = new Map<string, TileCursor>();
  let previous: TileCursor | undefined;
  for (const row of rows) {
    if (row.kind === 'header' || row.kind === 'unknown') continue;
    for (const [index, tile] of (tiles[row.id] ?? []).entries()) {
      const current = {itemId: row.id, index};
      addTransition(selected, tile, {current, previous});
      previous = current;
    }
  }
  return [...selected.values()];
}
