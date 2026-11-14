import {labelEdge} from './bibleTiles';
import type {SlideTile} from '../presentation/model';

export interface BiblePartIdentity {
  readonly label: SlideTile['label'];
  readonly part: number;
  readonly sourceSlideId?: SlideTile['sourceSlideId'];
}

function sameVerseLabel(
  left: SlideTile['label'],
  right: SlideTile['label'],
): boolean {
  return (
    (labelEdge(left, 'first') ?? left) === (labelEdge(right, 'first') ?? right)
  );
}

/** Finds a verse's part after a projection change, clamping a removed part. */
export function biblePartIndex(
  tiles: readonly SlideTile[],
  {label, part, sourceSlideId}: BiblePartIdentity,
): number | null {
  const indices: number[] = [];
  tiles.forEach((tile, index) => {
    if (
      sourceSlideId === undefined
        ? sameVerseLabel(tile.label, label)
        : tile.sourceSlideId === sourceSlideId
    ) {
      indices.push(index);
    }
  });
  return indices[Math.min(part - 1, indices.length - 1)] ?? null;
}

/** Keeps the verse and its part when inserting adjacent verses or remeasuring text. */
export function retainedBibleSelection(
  previous: readonly SlideTile[],
  selected: number,
  next: readonly SlideTile[],
): number {
  const current = previous[selected];
  const first = previous.findIndex(tile =>
    current?.sourceSlideId === undefined
      ? sameVerseLabel(tile.label, current?.label ?? null)
      : tile.sourceSlideId === current.sourceSlideId,
  );
  return (
    (first < 0 || current === undefined
      ? null
      : biblePartIndex(next, {
          label: current.label,
          part: current.biblePart ?? selected - first + 1,
          sourceSlideId: current.sourceSlideId,
        })) ?? Math.max(0, Math.min(selected, next.length - 1))
  );
}
