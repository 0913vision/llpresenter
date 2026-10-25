import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
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
    : (view.tiles[itemId] ?? noTiles);
}

/** Selects the open source's tiles without copying either projection. */
export function shownTiles(view: ShowView): readonly SlideTile[] | undefined {
  if (view.openItemId === null) return undefined;
  return isLibrarySource(view, view.openItemId)
    ? view.librarySong.tiles
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
