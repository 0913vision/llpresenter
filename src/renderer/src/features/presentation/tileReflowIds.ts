import type {SlideTile} from '@core/presentation/model';

/** Stable slide identities, with a separate occurrence for repeated song slides. */
export function tileReflowIds(
  tiles: readonly SlideTile[],
  itemId: string,
): string[] {
  const counts = new Map<string, number>();
  return tiles.map(tile => {
    const source = tile.sourceSlide?.slideId ?? tile.sourceSlideId;
    const identity =
      source ??
      JSON.stringify([
        tile.sectionCard,
        tile.verse?.reference,
        tile.biblePart,
        tile.media?.mediaId,
        tile.lines,
      ]);
    const ordinal = counts.get(identity) ?? 0;
    counts.set(identity, ordinal + 1);
    return `${itemId}:${identity}:${ordinal}`;
  });
}
