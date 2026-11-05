import type {SlideLayer} from '@core/live/state';
import type {RecentPassage} from '@core/schema/bible';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {passageBook} from '@core/bible/adjacentVerses';
import {biblePartIndex, retainedBibleSelection} from '@core/bible/selection';
import type {BibleSource} from '@core/bible/source';
import type {ItemId, SlideTile, TileCursor} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {sendLive, useLive} from './live';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from './showOutput';
import {useShow, type ShowView} from './showStore';
import {
  parseSlidesProjection,
  type SlidesProjection,
} from '@core/schema/slidesProjection';

const noTiles: readonly SlideTile[] = [];
type BibleTileResolver = (
  view: ShowView,
  itemId: ItemId,
) => readonly SlideTile[] | null;
let bibleTileResolver: BibleTileResolver | null = null;
let bibleMeasurement: SlidesProjection['measurement'] | null = null;
let detachedSelection: {
  readonly itemId: ItemId;
  readonly label: SlideTile['label'];
  readonly part: number;
  readonly sourceSlideId?: SlideTile['sourceSlideId'];
} | null = null;
let stopDetachedSelection: (() => void) | null = null;
let publishedSlides: {
  readonly api: NonNullable<Window['llp']>['service'];
  readonly id: string;
  readonly serviceId: string;
  readonly revision: number;
  readonly tiles: readonly SlideTile[];
  readonly measurement: SlidesProjection['measurement'];
} | null = null;

/** Sends only a changed, fully measured verse sequence before its live command. */
export function publishSlidesProjection(
  view: ShowView,
  itemId: ItemId,
  tiles: readonly SlideTile[],
): void {
  const row = view.rows.find(row => row.id === itemId);
  const api = window.llp;
  if (
    api === undefined ||
    view.serviceId === null ||
    row?.kind !== 'slides' ||
    row.sourceRevision === undefined ||
    bibleMeasurement === null ||
    !view.tiles[itemId]?.some(tile => tile.verse !== undefined) ||
    tiles.some(tile => tile.verse !== undefined)
  ) {
    return;
  }
  if (
    publishedSlides?.api === api.service &&
    publishedSlides.serviceId === view.serviceId &&
    publishedSlides.id === itemId &&
    publishedSlides.revision === row.sourceRevision &&
    publishedSlides.measurement === bibleMeasurement &&
    publishedSlides.tiles === tiles
  ) {
    return;
  }
  const parsed = parseSlidesProjection({
    serviceId: view.serviceId,
    itemId,
    revision: row.sourceRevision,
    measurement: bibleMeasurement,
    tiles,
  });
  if (!parsed.ok) {
    api.log.write({
      level: 'warn',
      message: 'Could not publish the verse slide sequence',
      detail: parsed.error.message,
    });
    return;
  }
  api.service.slidesProjection(parsed.value);
  publishedSlides = {
    api: api.service,
    serviceId: view.serviceId,
    id: itemId,
    revision: row.sourceRevision,
    tiles,
    measurement: bibleMeasurement,
  };
}

function forgetDetachedSelection(): void {
  detachedSelection = null;
  stopDetachedSelection?.();
  stopDetachedSelection = null;
}

/** Replaces the Bible projection atomically, retaining the selected verse and part. */
export function setBibleTileResolver(
  resolver: BibleTileResolver | null,
  measurement: SlidesProjection['measurement'] | null = null,
): void {
  if (resolver === null && bibleTileResolver === null) return;
  const view = useShow.getState();
  const id = view.openItemId;
  const previous = id === null ? null : (bibleTileResolver?.(view, id) ?? null);
  const before = id === null ? noTiles : tilesForView(view, id);
  const detached = detachedSelection;
  forgetDetachedSelection();
  bibleTileResolver = resolver;
  bibleMeasurement = resolver === null ? null : measurement;
  const next = id === null ? null : (resolver?.(view, id) ?? null);
  const restored =
    detached?.itemId === id && next !== null
      ? biblePartIndex(next, detached)
      : null;
  const selectedTile =
    restored ??
    (previous !== null || next !== null
      ? retainedBibleSelection(
          before,
          view.selectedTile,
          id === null ? noTiles : tilesForView(view, id),
        )
      : view.selectedTile);
  useShow.setState({selectedTile});
  const tile = previous?.[view.selectedTile];
  if (resolver === null && id !== null && tile !== undefined) {
    detachedSelection = {
      itemId: id,
      label: tile.label,
      part: tile.biblePart ?? 1,
      ...(tile.sourceSlideId === undefined
        ? {}
        : {sourceSlideId: tile.sourceSlideId}),
    };
    stopDetachedSelection = useShow.subscribe(current => {
      if (current.openItemId !== id || current.selectedTile !== selectedTile) {
        forgetDetachedSelection();
      }
    });
  }
}

/** Resolves a live Bible part against today's projection without changing output. */
export function projectedLiveCursor(
  view: ShowView,
  slide: SlideLayer | null,
): TileCursor | null {
  if (slide === null) return null;
  const index =
    slide.biblePart === undefined && slide.sourceSlideId === undefined
      ? slide.position
      : biblePartIndex(tilesForView(view, slide.itemId), {
          label: slide.label,
          part: slide.biblePart ?? 1,
          sourceSlideId: slide.sourceSlideId,
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
  if (slide.biblePart !== undefined) {
    return biblePartIndex(tiles, {label: slide.label, part: slide.biblePart});
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
  const projected = bibleTileResolver?.(view, itemId);
  if (projected !== null && projected !== undefined) return projected;
  return isLibrarySource(view, itemId)
    ? view.librarySong.tiles
    : isBibleSource(view, itemId)
      ? (bibleSourceFor(view, itemId)?.tiles ?? noTiles)
      : (view.tiles[itemId] ?? noTiles);
}

/** Selects the open source's tiles without copying either projection. */
export function shownTiles(view: ShowView): readonly SlideTile[] | undefined {
  if (view.openItemId === null) return undefined;
  const tiles = tilesForView(view, view.openItemId);
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
