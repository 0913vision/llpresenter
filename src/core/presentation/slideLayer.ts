import type {NextSlide, SlideLayer} from '../live/state';
import type {SlideTile, TileCursor} from './model';
import type {TilesOf} from './navigation';
import {LIVE_STATE_LIMITS} from '../schema/liveLimits';

/** Projects a tile into the live stage preview payload. */
export function nextSlideOf(
  tile: SlideTile,
  kind?: NextSlide['itemKind'],
  context?: {
    readonly title?: string | undefined;
    readonly after?: SlideTile | undefined;
    readonly textSlideNumber?: number | undefined;
  },
): NextSlide {
  const notice =
    tile.sectionCard === undefined &&
    tile.kind === 'ad' &&
    tile.picture === undefined;
  const title =
    (notice && context?.textSlideNumber !== undefined
      ? `${context.textSlideNumber}. ${tile.name ?? ''}`.trim()
      : undefined) ??
    tile.sectionCard?.name ??
    tile.name ??
    (tile.media !== undefined || tile.picture !== undefined
      ? context?.title
      : undefined);
  return {
    label:
      tile.sectionCard !== undefined
        ? null
        : (tile.slideLabel ??
          (tile.kind === undefined || tile.biblePart !== undefined
            ? tile.label
            : null)),
    lines: tile.sectionCard === undefined && !notice ? tile.lines : [],
    ...(kind === undefined ? {} : {itemKind: kind}),
    ...(title === undefined || title.trim() === '' ? {} : {title}),
    ...(tile.continued === undefined ? {} : {continued: tile.continued}),
    ...(tile.biblePart === undefined ? {} : {biblePart: tile.biblePart}),
    ...(tile.titleSlide === undefined ? {} : {titleSlide: tile.titleSlide}),
  };
}

/** Counts text notices without counting pictures or section cards. */
export function noticeNumber(
  tiles: readonly SlideTile[],
  index: number,
): number | undefined {
  const tile = tiles[index];
  if (
    tile?.kind !== 'ad' ||
    tile.picture !== undefined ||
    tile.sectionCard !== undefined
  ) {
    return undefined;
  }
  return tiles
    .slice(0, index + 1)
    .filter(
      value =>
        value.kind === 'ad' &&
        value.picture === undefined &&
        value.sectionCard === undefined,
    ).length;
}

type BibleItemSlides = NonNullable<SlideLayer['bibleItemSlides']>;
const bibleGroups = new WeakMap<readonly SlideTile[], BibleItemSlides | null>();

function bibleGroup(tiles: readonly SlideTile[]): BibleItemSlides | undefined {
  if (bibleGroups.has(tiles)) return bibleGroups.get(tiles) ?? undefined;
  const parts = tiles.filter(part => part.biblePart !== undefined);
  const lines = parts.reduce((sum, part) => sum + part.lines.length, 0);
  const characters = parts.reduce(
    (sum, part) =>
      sum + part.lines.reduce((total, line) => total + line.length, 0),
    0,
  );
  const group =
    parts.length > 0 &&
    parts.length <= LIVE_STATE_LIMITS.bibleItemSlides &&
    lines <= LIVE_STATE_LIMITS.bibleItemLines &&
    characters <= LIVE_STATE_LIMITS.bibleItemCharacters &&
    parts.every(
      part =>
        part.lines.length <= LIVE_STATE_LIMITS.slideLines &&
        part.lines.every(
          line => line.length <= LIVE_STATE_LIMITS.textCharacters,
        ),
    )
      ? parts.map(part => ({
          lines: part.lines,
          ...(part.continued === undefined ? {} : {continued: part.continued}),
        }))
      : undefined;
  bibleGroups.set(tiles, group ?? null);
  return group;
}

/**
 * The 장 layer that outputting a tile sends, or null when the tile is missing.
 * It carries the item's next tile for the 무대 화면, and none after the last.
 */
export function slideLayerOf(
  cursor: TileCursor,
  tilesOf: TilesOf,
  following?: {
    readonly tile: SlideTile;
    readonly kind: 'song' | 'bible' | 'blank' | 'ad' | 'media';
    readonly title?: string;
    readonly after?: SlideTile;
    readonly textSlideNumber?: number | undefined;
  },
): SlideLayer | null {
  const tiles = tilesOf(cursor.itemId);
  const tile = tiles[cursor.index];
  if (!tile) return null;
  const next = tiles[cursor.index + 1] ?? following?.tile;
  const bibleItemSlides =
    tile.biblePart === undefined ? undefined : bibleGroup(tiles);
  return {
    itemId: cursor.itemId,
    position: cursor.index,
    sequenceLength: tiles.length,
    ...(bibleItemSlides === undefined ? {} : {bibleItemSlides}),
    ...(tile.kind === 'ad' && tile.picture === undefined
      ? {
          textSlideNumber: tiles
            .slice(0, cursor.index + 1)
            .filter(tile => tile.kind === 'ad' && tile.picture === undefined)
            .length,
        }
      : {}),
    ...(tile.biblePart === undefined ? {} : {biblePart: tile.biblePart}),
    ...(tile.sourceSlideId === undefined
      ? {}
      : {sourceSlideId: tile.sourceSlideId}),
    label:
      tile.slideLabel ??
      (tile.kind === undefined || tile.biblePart !== undefined
        ? tile.label
        : null),
    lines: tile.lines,
    ...(tile.sectionCard === undefined ? {} : {sectionCard: tile.sectionCard}),
    ...(tile.titleSlide === undefined ? {} : {titleSlide: tile.titleSlide}),
    ...(tile.lyricFormat === undefined ? {} : {lyricFormat: tile.lyricFormat}),
    ...(tile.titleLayout === undefined ? {} : {titleLayout: tile.titleLayout}),
    ...(tile.transition === undefined ? {} : {transition: tile.transition}),
    ...(tile.name === undefined ? {} : {name: tile.name}),
    ...(tile.picture === undefined ? {} : {picture: tile.picture}),
    ...(tile.kind === undefined ? {} : {kind: tile.kind}),
    ...(tile.continued === undefined ? {} : {continued: tile.continued}),
    ...(tile.reference === undefined ? {} : {reference: tile.reference}),
    ...(next === undefined
      ? {}
      : {
          next: nextSlideOf(
            next,
            tiles[cursor.index + 1] === undefined ? following?.kind : undefined,
            {
              title: following?.title,
              textSlideNumber:
                tiles[cursor.index + 1] === undefined
                  ? following?.textSlideNumber
                  : noticeNumber(tiles, cursor.index + 1),
              after:
                tiles[cursor.index + 1] === undefined
                  ? following?.after
                  : tiles[cursor.index + 2],
            },
          ),
        }),
  };
}
