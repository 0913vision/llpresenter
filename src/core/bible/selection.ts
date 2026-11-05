import type {SlideTile} from '../presentation/model';

/** Finds a verse's part after a projection change, clamping a removed part. */
export function biblePartIndex(
  tiles: readonly SlideTile[],
  label: SlideTile['label'],
  part: number,
): number | null {
  const indices: number[] = [];
  tiles.forEach((tile, index) => {
    if (tile.label === label) indices.push(index);
  });
  return indices[Math.min(part - 1, indices.length - 1)] ?? null;
}

/** Keeps the verse and its part when inserting adjacent verses or remeasuring text. */
export function retainedBibleSelection(
  previous: readonly SlideTile[],
  selected: number,
  next: readonly SlideTile[],
): number {
  const label = previous[selected]?.label;
  const first = previous.findIndex(tile => tile.label === label);
  return (
    (first < 0 || label === undefined
      ? null
      : biblePartIndex(next, label, selected - first + 1)) ??
    Math.max(0, Math.min(selected, next.length - 1))
  );
}
