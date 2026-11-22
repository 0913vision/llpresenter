import {rememberLiveAnchor, resolveLiveAnchor} from './liveAnchor';
import type {MediaChoice, SlideLayer} from '@core/live/state';
import type {RecentPassage} from '@core/schema/bible';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {passageBook} from '@core/bible/adjacentVerses';
import {biblePartIndex} from '@core/bible/selection';
import type {BibleSource} from '@core/bible/source';
import type {ItemId, SlideTile, TileCursor} from '@core/presentation/model';
import {useLive} from './live';
import {correctSlideOutput} from './itemOutput';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from './showOutput';
import {useShow, type ShowView} from './showStore';

const noTiles: readonly SlideTile[] = [];
/** Resolves a live Bible part against today's projection without changing output. */
export function projectedLiveCursor(
  view: ShowView,
  slide: SlideLayer | null,
): TileCursor | null {
  if (slide === null) return null;
  const anchored = resolveLiveAnchor(view, slide);
  if (anchored !== null) return anchored.live;
  const index =
    slide.biblePart === undefined &&
    slide.sourceSlideId === undefined &&
    slide.bibleVerse === undefined
      ? slide.position
      : biblePartIndex(tilesForView(view, slide.itemId), {
          label: slide.label,
          part: slide.biblePart ?? 1,
          sourceSlideId: slide.sourceSlideId,
          bibleVerse: slide.bibleVerse,
        });
  return index === null ? null : {itemId: slide.itemId, index};
}

export function isBibleSource(view: ShowView, itemId: ItemId | null): boolean {
  return bibleSourceFor(view, itemId) !== null;
}

export function bibleSourceFor(
  view: ShowView,
  itemId: ItemId | null,
): ShowView['bibleSource'] {
  if (view.bibleSource?.id === itemId) return view.bibleSource;
  if (view.liveBibleSource?.id === itemId) return view.liveBibleSource;
  const held = view.readyPassage?.previousSource;
  if (held?.id === itemId) return held;
  return view.requestedBibleSource?.id === itemId
    ? view.requestedBibleSource
    : null;
}

function showsSameVerses(
  first: BibleSource,
  second: {readonly passage: RecentPassage; readonly verseNumbers: boolean},
): boolean {
  const book = passageBook(first.passage);
  return (
    book !== undefined &&
    book.id === passageBook(second.passage)?.id &&
    first.passage.translation === second.passage.translation &&
    first.verseNumbers === second.verseNumbers
  );
}

/**
 * The open tile that shows the live slide: the live tile of the open item, or
 * the same verse of an open Bible passage drawn like the live one, such as a
 * live passage with 뒤 절 추가.
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
  const live = bibleSourceFor(view, slide.itemId);
  const row = view.rows.find(candidate => candidate.id === slide.itemId);
  const saved = row?.kind === 'bible' ? row.bible : undefined;
  const passage = live?.passage ?? saved;
  const verseNumbers = live?.verseNumbers ?? saved?.verseNumbers ?? true;
  const cursor = projectedLiveCursor(view, slide);
  const tile =
    cursor === null
      ? undefined
      : tilesForView(view, slide.itemId)[cursor.index];
  if (
    !open ||
    !passage ||
    !tile ||
    !showsSameVerses(open, {passage, verseNumbers})
  ) {
    return null;
  }
  const tiles = tilesForView(view, open.id);
  if (slide.biblePart !== undefined || slide.bibleVerse !== undefined) {
    return biblePartIndex(tiles, {
      label: slide.label,
      part: slide.biblePart ?? 1,
      bibleVerse: slide.bibleVerse,
    });
  }
  const matching = tiles.findIndex(
    candidate =>
      candidate.label === tile.label &&
      candidate.lines.join('\n') === tile.lines.join('\n'),
  );
  const index =
    matching >= 0
      ? matching
      : tiles.findIndex(candidate => candidate.label === tile.label);
  return index === -1 ? null : index;
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
    : isBibleSource(view, itemId)
      ? (bibleSourceFor(view, itemId)?.tiles ?? noTiles)
      : (view.tiles[itemId] ?? noTiles);
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

/** Selects the open source's tiles without copying either projection. */
export function shownTiles(view: ShowView): readonly SlideTile[] | undefined {
  return shownTilesFor(view, view.openItemId);
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
  rememberLiveAnchor(current, useLive.getState().state?.layers.slide ?? null);
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

/** A failed refresh outputs the cached tile and its own cached background. */
export async function outputLibraryTile(
  cursor: TileCursor,
  request: number,
  options: {
    readonly commandVersion: number;
    readonly reverseTransition?: SlideLayer['reverseTransition'];
    readonly initialSlide: SlideLayer;
    readonly initialBackground: MediaChoice | undefined;
    readonly resolveSlide: () => SlideLayer | null;
  },
): Promise<void> {
  const {
    commandVersion,
    reverseTransition,
    initialSlide,
    initialBackground,
    resolveSlide,
  } = options;
  const initial = useShow.getState();
  const api = window.llp;
  if (!api || !isLibrarySource(initial, cursor.itemId)) return;
  const songId = initial.librarySong.songId;
  let song: ShowLibrarySong | null | undefined;
  try {
    song = await withinLookupTimeout(() => api.library.showSong({songId}));
  } catch (cause) {
    api.log.write({
      level: 'warn',
      message:
        'Could not refresh the library song background; using its cached choice',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
  }
  const current = useShow.getState();
  if (
    !isOutputRequestCurrent(request, commandVersion) ||
    !isLibrarySource(current, cursor.itemId)
  ) {
    return;
  }
  if (song !== undefined) refreshLibrarySong(songId, song);
  if (song === null) return;
  const latest = useShow.getState();
  if (
    !isOutputRequestCurrent(request, commandVersion) ||
    !isLibrarySource(latest, cursor.itemId)
  ) {
    return;
  }
  const slide = resolveSlide();
  if (!slide) return;
  const nextSlide =
    reverseTransition === undefined ? slide : {...slide, reverseTransition};
  const background = latest.librarySong.background;
  const backgroundChanged =
    JSON.stringify(background) !== JSON.stringify(initialBackground);
  if (
    backgroundChanged ||
    JSON.stringify(nextSlide) !== JSON.stringify(initialSlide)
  ) {
    correctSlideOutput(nextSlide, {background, backgroundChanged});
  }
}
