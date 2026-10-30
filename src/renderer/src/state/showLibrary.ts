import type {SlideLayer} from '@shared/live';
import type {RecentPassage} from '@shared/schema/bible';
import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
import {passageBook} from '@renderer/show/bible/adjacentVerses';
import type {BibleSource} from '@renderer/show/bible/source';
import type {ItemId, SlideTile, TileCursor} from '@renderer/show/model';
import {slideLayerOf} from '@renderer/show/slideLayer';
import {sendLive, useLive} from './live';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from './showOutput';
import {useShow, type ShowView} from './showStore';

const noTiles: readonly SlideTile[] = [];

export function isBibleSource(view: ShowView, itemId: ItemId | null): boolean {
  return bibleSourceFor(view, itemId) !== null;
}

export function bibleSourceFor(
  view: ShowView,
  itemId: ItemId | null,
): ShowView['bibleSource'] {
  if (view.bibleSource?.id === itemId) return view.bibleSource;
  if (view.liveBibleSource?.id === itemId) return view.liveBibleSource;
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
  if (slide.itemId === view.openItemId) return slide.position;
  const open = bibleSourceFor(view, view.openItemId);
  const live = bibleSourceFor(view, slide.itemId);
  const row = view.rows.find(candidate => candidate.id === slide.itemId);
  const saved = row?.kind === 'bible' ? row.bible : undefined;
  const passage = live?.passage ?? saved;
  const verseNumbers = live?.verseNumbers ?? saved?.verseNumbers ?? true;
  const tile = (live?.tiles ?? view.tiles[slide.itemId])?.[slide.position];
  if (
    !open ||
    !passage ||
    !tile ||
    !showsSameVerses(open, {passage, verseNumbers})
  ) {
    return null;
  }
  const index = open.tiles.findIndex(
    candidate => candidate.label === tile.label,
  );
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

/** Selects the open source's tiles without copying either projection. */
export function shownTiles(view: ShowView): readonly SlideTile[] | undefined {
  if (view.openItemId === null) return undefined;
  return isLibrarySource(view, view.openItemId) ||
    isBibleSource(view, view.openItemId)
    ? tilesForView(view, view.openItemId)
    : view.tiles[view.openItemId];
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

/** A failed refresh outputs the current cached tile while retaining live media. */
export async function outputLibraryTile(
  cursor: TileCursor,
  request: number,
  commandVersion: number,
): Promise<void> {
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
        'Could not refresh the library song background; kept the current media',
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
  const slide = slideLayerOf(cursor, itemId => tilesForView(latest, itemId));
  if (!slide) return;
  const background =
    song?.songId === songId &&
    song.songRevision === latest.librarySong.songRevision
      ? latest.librarySong.background
      : undefined;
  const media = useLive.getState().state?.layers.media;
  if (
    background &&
    (media?.mediaId !== background.mediaId || media.loop !== background.loop)
  ) {
    sendLive({type: 'media.show', media: background});
  }
  sendLive({type: 'slide.show', slide});
}
