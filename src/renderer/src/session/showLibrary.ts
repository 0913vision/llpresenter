import {sameVerse} from '@core/slides';
import type {SlideLayer} from '@core/schema/live';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {ItemId, SlideTile, TileCursor} from '@core/presentation';
import type {BibleSource} from './bibleSource';
import {useLive} from './live';
import {beginOutputRequest} from './showOutput';
import {useShow, type ShowView} from './showStore';

const noTiles: readonly SlideTile[] = [];
/** The open passage, the live one, and the one before them. */
const MAX_BIBLE_SOURCES = 3;

export function bibleSourceFor(
  view: ShowView,
  itemId: ItemId | null,
): BibleSource | null {
  return view.bibleSources.find(source => source.id === itemId) ?? null;
}

export function isBibleSource(view: ShowView, itemId: ItemId | null): boolean {
  return bibleSourceFor(view, itemId) !== null;
}

/** The passages with this one opened last; the live one is never dropped. */
export function withBibleSource(
  view: ShowView,
  source: BibleSource,
  liveItemId: ItemId | null,
): readonly BibleSource[] {
  const others = view.bibleSources.filter(entry => entry.id !== source.id);
  const live = others.find(entry => entry.id === liveItemId);
  const kept = others.filter(entry => entry !== live);
  return [source, ...(live === undefined ? [] : [live]), ...kept].slice(
    0,
    MAX_BIBLE_SOURCES,
  );
}

/** The tile of the live slide, by the slide itself. */
export function projectedLiveCursor(
  view: ShowView,
  slide: SlideLayer | null,
): TileCursor | null {
  if (slide === null) return null;
  const index = tilesForView(view, slide.itemId).findIndex(
    tile => tile.slide.id === slide.slideId,
  );
  return index < 0 ? null : {itemId: slide.itemId, index};
}

/**
 * The open tile that shows the live slide: the live tile of the open item, or
 * the same verse of an open passage.
 */
export function liveTileIndex(
  view: ShowView,
  slide: SlideLayer | null,
): number | null {
  if (slide === null || view.openItemId === null) return null;
  if (slide.itemId === view.openItemId) {
    return projectedLiveCursor(view, slide)?.index ?? null;
  }
  const open = bibleSourceFor(view, view.openItemId);
  if (open === null || slide.verse === undefined) return null;
  const {verse} = slide;
  const texts = JSON.stringify(slide.texts);
  const same = open.tiles.flatMap((tile, index) =>
    tile.slide.verse !== undefined && sameVerse(tile.slide.verse, verse)
      ? [{index, exact: JSON.stringify(tile.slide.texts) === texts}]
      : [],
  );
  return (same.find(entry => entry.exact) ?? same[0])?.index ?? null;
}

/** Follows {@link liveTileIndex} for the open item. */
export function useLiveTileIndex(): number | null {
  const slide = useLive(view => view.state?.layers.slide ?? null);
  return useShow(view => liveTileIndex(view, slide));
}

/** Namespaces a library source without inventing a service item. */
export function librarySourceId(songId: ShowLibrarySong['songId']): ItemId {
  return `library:${songId}`;
}

/** Narrows the retained projection only when it belongs to this source. */
export function isLibrarySource(
  view: ShowView,
  itemId: ItemId | null,
): view is ShowView & {readonly librarySong: ShowLibrarySong} {
  return (
    view.librarySong !== null &&
    itemId === librarySourceId(view.librarySong.songId)
  );
}

export function tilesForView(
  view: ShowView,
  itemId: ItemId,
): readonly SlideTile[] {
  return isLibrarySource(view, itemId)
    ? view.librarySong.tiles
    : (bibleSourceFor(view, itemId)?.tiles ?? view.tiles[itemId] ?? noTiles);
}

/** Selects a source's tiles without copying either projection. */
export function shownTilesFor(
  view: ShowView,
  itemId: ItemId | null,
): readonly SlideTile[] | undefined {
  if (itemId === null) return undefined;
  const tiles = tilesForView(view, itemId);
  return tiles === noTiles ? undefined : tiles;
}

/** Opens a checked library projection without writing a service or output. */
export function openLibrarySong(song: ShowLibrarySong): void {
  beginOutputRequest();
  useShow.setState({
    librarySong: song,
    openItemId: librarySourceId(song.songId),
    selectedTile: 0,
  });
}

/** Updates only the retained source; deletion leaves live output alone. */
export function refreshLibrarySong(
  songId: ShowLibrarySong['songId'],
  song: ShowLibrarySong | null,
): void {
  const current = useShow.getState();
  if (
    !isLibrarySource(current, librarySourceId(songId)) ||
    (song && song.songId !== songId) ||
    (song && song.songRevision < current.librarySong.songRevision)
  ) {
    return;
  }
  const selected = isLibrarySource(current, current.openItemId);
  useShow.setState({
    librarySong: song,
    ...(selected
      ? {
          openItemId: song ? librarySourceId(songId) : null,
          selectedTile: song
            ? Math.min(current.selectedTile, Math.max(0, song.tiles.length - 1))
            : 0,
        }
      : {}),
  });
}
