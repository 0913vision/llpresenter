import type {ShowTile, SongSlideSource} from '../schema/showService';

export interface SlideHotKeyTarget {
  readonly tileIndex: number;
  readonly sourceSlide: SongSlideSource;
}

/** Resolves the first projected occurrence, independent of the selected/live tile. */
export function findSlideHotKey(
  tiles: ReadonlyArray<Pick<ShowTile, 'hotKey' | 'sourceSlide'>>,
  code: string,
): SlideHotKeyTarget | null {
  const tileIndex = tiles.findIndex(
    tile => tile.hotKey === code && tile.sourceSlide !== undefined,
  );
  const sourceSlide = tiles[tileIndex]?.sourceSlide;
  return sourceSlide === undefined ? null : {tileIndex, sourceSlide};
}
