import type {SlideLayer, SlidePeer} from '@core/schema/live';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import type {ThemeFile} from '@core/schema/theme';
import {nextTextOf} from '@core/theme';
import {tileContent} from '@core/slides';
import type {SlideTile, TileCursor} from './model';
import type {TilesOf} from './navigation';

/** The theme a slide is drawn with. */
export type ThemeLookup = (tile: SlideTile) => ThemeFile;

/** What a tile lets the slide before it show as its next text. */
export function nextTextOfTile(
  tile: SlideTile,
  theme: ThemeLookup,
  first: boolean,
): string | null {
  return nextTextOf(theme(tile), tileContent(tile), first);
}

/** Whether a theme sizes a text together with the other slides of the item. */
export function sharesSizes(theme: ThemeFile): boolean {
  return Object.values(theme.screens).some(
    screen =>
      screen.mode === 'own' &&
      screen.elements.some(
        element => element.kind === 'text' && element.fit?.together === true,
      ),
  );
}

/** The slides of an item that have a theme in common, for sizes they share. */
export function peersOf(
  tiles: readonly SlideTile[],
  theme: ThemeFile,
): readonly SlidePeer[] | undefined {
  if (!sharesSizes(theme)) return undefined;
  return tiles
    .filter(tile => tile.slide.theme === theme.id)
    .slice(0, LIVE_STATE_LIMITS.slidePeers)
    .map(({slide, auto}) => ({
      texts: slide.texts,
      auto,
      ...(slide.continued === undefined ? {} : {continued: true}),
    }));
}

/**
 * The slide that outputting a tile sends, or null when the tile is missing.
 * `following` is the tile that the next-slide key goes to after it.
 */
export function slideLayerOf(
  cursor: TileCursor,
  tilesOf: TilesOf,
  {
    theme,
    following,
  }: {
    readonly theme: ThemeLookup;
    readonly following: TileCursor | null;
  },
): SlideLayer | null {
  const tiles = tilesOf(cursor.itemId);
  const tile = tiles[cursor.index];
  if (tile === undefined) return null;
  const {slide, auto} = tile;
  const own = theme(tile);
  const peers = peersOf(tiles, own);
  const after =
    following === null ? undefined : tilesOf(following.itemId)[following.index];
  const atEnd = cursor.index === tiles.length - 1;
  const next =
    after === undefined || (atEnd && own.hideNextAtEnd === true)
      ? null
      : nextTextOfTile(
          after,
          theme,
          following?.itemId !== cursor.itemId || following.index === 0,
        );
  return {
    itemId: cursor.itemId,
    slideId: slide.id,
    position: cursor.index,
    sequenceLength: tiles.length,
    theme: slide.theme,
    texts: slide.texts,
    auto,
    next,
    ...(slide.continued === undefined ? {} : {continued: true}),
    ...(slide.background === undefined ? {} : {background: slide.background}),
    ...(slide.verse === undefined ? {} : {verse: slide.verse}),
    ...(slide.transition === undefined ? {} : {transition: slide.transition}),
    ...(peers === undefined ? {} : {peers}),
  };
}
