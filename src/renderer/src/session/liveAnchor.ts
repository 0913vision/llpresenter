import type {SlideLayer} from '@core/live/state';
import type {SlideTile, TileCursor} from '@core/presentation/model';
import type {ShowView} from './showStore';
import {tilesForView} from './showLibrary';

interface Anchor {
  readonly serviceId: string | null;
  readonly signature: string;
  readonly itemId: string;
  readonly identity: string | null;
  readonly occurrence: number;
  readonly successors: readonly string[];
  readonly followingItems: readonly string[];
}

let anchor: Anchor | null = null;

function signature(slide: SlideLayer): string {
  const {next: _next, ...current} = slide;
  return JSON.stringify(current);
}

function identity(tile: SlideTile): string | null {
  if (tile.sectionCard !== undefined) {
    return `section:${tile.sectionCard.name}:${tile.sectionCard.theme}`;
  }
  if (tile.sourceSlide !== undefined) {
    return `song:${tile.sourceSlide.songId}:${tile.sourceSlide.slideId}`;
  }
  if (tile.sourceSlideId !== undefined) {
    return `slide:${tile.sourceSlideId}:${tile.biblePart ?? 1}`;
  }
  if (tile.biblePart !== undefined) {
    return `verse:${tile.label}:${tile.biblePart}`;
  }
  return `text:${tile.label}:${JSON.stringify(tile.lines)}`;
}

function findOccurrence(
  tiles: readonly SlideTile[],
  id: string,
  occurrence: number,
): number {
  let seen = 0;
  return tiles.findIndex(tile => {
    if (identity(tile) !== id) return false;
    return seen++ === occurrence;
  });
}

function matches(view: ShowView, slide: SlideLayer): Anchor | null {
  return anchor?.serviceId === view.serviceId &&
    anchor.signature === signature(slide)
    ? anchor
    : null;
}

/** Remember source identities before a service refresh replaces its projection. */
export function rememberLiveAnchor(
  view: ShowView,
  slide: SlideLayer | null,
): void {
  if (slide === null) {
    anchor = null;
    return;
  }
  const existing = matches(view, slide);
  const tiles = tilesForView(view, slide.itemId);
  const index =
    existing?.identity != null
      ? findOccurrence(tiles, existing.identity, existing.occurrence)
      : slide.position;
  const tile = tiles[index];
  if (existing && (index < 0 || tile === undefined)) return;
  if (tile === undefined) return;
  const rowIndex = view.rows.findIndex(row => row.id === slide.itemId);
  anchor = {
    serviceId: view.serviceId,
    signature: signature(slide),
    itemId: slide.itemId,
    identity: existing?.identity ?? identity(tile),
    occurrence: tiles
      .slice(0, index)
      .filter(value => identity(value) === identity(tile)).length,
    successors: tiles
      .slice(index + 1)
      .map(identity)
      .filter((value): value is string => value !== null),
    followingItems:
      rowIndex < 0
        ? []
        : view.rows
            .slice(rowIndex + 1)
            .filter(row => row.kind !== 'header')
            .map(row => row.id),
  };
}

/** Resolve the sent slide and, if it was removed, the first surviving successor. */
export function resolveLiveAnchor(
  view: ShowView,
  slide: SlideLayer,
): {live: TileCursor | null; next: TileCursor | null} | null {
  const saved = matches(view, slide);
  if (saved?.identity == null) return null;
  const rowExists =
    view.rows.some(row => row.kind !== 'header' && row.id === saved.itemId) ||
    (view.librarySong?.songId !== undefined &&
      saved.itemId === `library:${view.librarySong.songId}`) ||
    view.bibleSource?.id === saved.itemId ||
    view.liveBibleSource?.id === saved.itemId;
  const tiles = rowExists ? tilesForView(view, saved.itemId) : [];
  const index = findOccurrence(tiles, saved.identity, saved.occurrence);
  if (index >= 0) return {live: {itemId: saved.itemId, index}, next: null};
  for (const id of saved.successors) {
    const next = tiles.findIndex(tile => identity(tile) === id);
    if (next >= 0) {
      return {live: null, next: {itemId: saved.itemId, index: next}};
    }
  }
  for (const id of saved.followingItems) {
    if (
      view.rows.some(row => row.kind !== 'header' && row.id === id) &&
      tilesForView(view, id).length > 0
    ) {
      return {live: null, next: {itemId: id, index: 0}};
    }
  }
  return {live: null, next: null};
}
