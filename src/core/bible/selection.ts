import {labelEdge} from './bibleTiles';
import type {SlideTile} from '../presentation/model';

export interface BiblePartIdentity {
  readonly label: SlideTile['label'];
  readonly part: number;
  readonly sourceSlideId?: SlideTile['sourceSlideId'];
  readonly bibleVerse?: SlideTile['bibleVerse'];
}

export function sameBibleVerse(
  left: NonNullable<SlideTile['bibleVerse']>,
  right: NonNullable<SlideTile['bibleVerse']>,
): boolean {
  return (
    left.translation === right.translation &&
    left.book === right.book &&
    left.chapter === right.chapter &&
    left.verse === right.verse
  );
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
  {label, part, sourceSlideId, bibleVerse}: BiblePartIdentity,
): number | null {
  const indices: number[] = [];
  tiles.forEach((tile, index) => {
    if (tile.sectionCard !== undefined) return;
    if (
      sourceSlideId !== undefined
        ? tile.sourceSlideId === sourceSlideId
        : bibleVerse !== undefined
          ? tile.bibleVerse !== undefined &&
            sameBibleVerse(tile.bibleVerse, bibleVerse)
          : sameVerseLabel(tile.label, label)
    ) {
      indices.push(index);
    }
  });
  return (
    indices.find(index => tiles[index]?.biblePart === part) ??
    indices[Math.min(part - 1, indices.length - 1)] ??
    null
  );
}

/** Keeps the verse and its part when inserting adjacent verses or remeasuring text. */
export function retainedBibleSelection(
  previous: readonly SlideTile[],
  selected: number,
  next: readonly SlideTile[],
): number {
  const current = previous[selected];
  if (current?.sectionCard !== undefined) {
    const card = next.findIndex(tile => tile.sectionCard !== undefined);
    return card < 0 ? Math.max(0, Math.min(selected, next.length - 1)) : card;
  }
  if (current?.sermonTitle && current.textSlideKey !== undefined) {
    const title = next.findIndex(
      tile => tile.textSlideKey === current.textSlideKey,
    );
    return title < 0 ? Math.max(0, Math.min(selected, next.length - 1)) : title;
  }
  const first = previous.findIndex(
    tile =>
      tile.sectionCard === undefined &&
      (current?.sourceSlideId !== undefined
        ? tile.sourceSlideId === current.sourceSlideId
        : current?.bibleVerse !== undefined
          ? tile.bibleVerse !== undefined &&
            sameBibleVerse(tile.bibleVerse, current.bibleVerse)
          : sameVerseLabel(tile.label, current?.label ?? null)),
  );
  return (
    (first < 0 || current === undefined
      ? null
      : biblePartIndex(next, {
          label: current.label,
          part: current.biblePart ?? selected - first + 1,
          sourceSlideId: current.sourceSlideId,
          bibleVerse: current.bibleVerse,
        })) ?? Math.max(0, Math.min(selected, next.length - 1))
  );
}
