import type {Preferences} from '@core/schema/preferences';
import type {NextSlide} from '@core/live/state';
import type {SingleLiveCommand} from '@core/live/commands';
import {findSlideHotKey} from '@core/services/slideHotKeys';
import {parseServiceItemId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {
  type ItemId,
  type SlideTile,
  type TileCursor,
} from '@core/presentation/model';
import {
  adjacentItem,
  liveItem,
  nextTileAtLast,
  previousTileAtFirst,
  type SequenceState,
} from '@core/presentation/navigation';
import {
  nextSlideOf,
  noticeNumber,
  slideLayerOf,
} from '@core/presentation/slideLayer';
import {rememberBiblePassage} from '@renderer/session/recentWriter';
import {sendLive, useLive} from './live';
import {sendMediaOutput, sendSlideOutput} from './itemOutput';
import {
  bibleSourceFor,
  isBibleSource,
  isLibrarySource,
  liveTileIndex,
  projectedLiveCursor,
  publishSlidesProjection,
  outputLibraryTile,
  tilesForView,
} from './showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from './showOutput';
import {noService, useShow, type ShowView} from './showStore';

export {useShow} from './showStore';

type AtLastSlide = Preferences['show']['atLastSlide'];

declare global {
  interface Window {
    __llpShowStore?: typeof useShow;
  }
}

// NOTE(0913vision): Exposes show store for offscreen CDP automated testing.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__llpShowStore = useShow;
}

export function tilesOf(itemId: ItemId): readonly SlideTile[] {
  return tilesForView(useShow.getState(), itemId);
}

/** The tile on output, taken from the live slide layer. */
export function liveCursor(): TileCursor | null {
  const view = useShow.getState();
  const state = useLive.getState().state;
  const slide = projectedLiveCursor(view, state?.layers.slide ?? null);
  if (slide !== null) return slide;
  const item = state?.themeItem;
  const media = state?.layers.media;
  if (item?.kind !== 'media' || item.contentCleared || media == null) {
    return null;
  }
  const index = tilesForView(view, item.id).findIndex(
    tile => tile.media?.mediaId === media.mediaId,
  );
  return index < 0 ? null : {itemId: item.id, index};
}

// NOTE(0913vision): A Bible passage that grew around the live verse is a new
// item, so the next and previous 장 keys go on from that verse inside it
// instead of starting the passage over.
function sequenceState(): SequenceState {
  const view = useShow.getState();
  const index = liveTileIndex(
    view,
    useLive.getState().state?.layers.slide ?? null,
  );
  const live =
    view.openItemId !== null && index !== null
      ? {itemId: view.openItemId, index}
      : liveCursor();
  return {tilesOf, live, openItemId: view.openItemId};
}

/** Resolves a live quick-run library slide to its service-order position. */
function previousSequenceState(): SequenceState {
  const state = sequenceState();
  const actual = liveCursor();
  const view = useShow.getState();
  if (actual === null) return state;
  if (
    view.rows.some(row => row.kind !== 'header' && row.id === actual.itemId)
  ) {
    return {...state, live: actual};
  }
  if (!isLibrarySource(view, actual.itemId)) return state;
  const source = view.librarySong.tiles[actual.index]?.sourceSlide;
  if (source === undefined) return state;
  const matches = view.rows.flatMap(row => {
    if (row.kind !== 'song') return [];
    return tilesOf(row.id).flatMap((tile, index) =>
      tile.sourceSlide?.songId === source.songId &&
      tile.sourceSlide.slideId === source.slideId
        ? [{itemId: row.id, index}]
        : [],
    );
  });
  const match =
    matches.find(value => value.itemId === view.openItemId) ?? matches[0];
  return match === undefined ? state : {...state, live: match};
}

/**
 * Opens an item in the 장 panel and selects its first tile. Opening the item
 * that is already open keeps its tile selection.
 */
export function openItem(itemId: ItemId): void {
  if (useShow.getState().openItemId === itemId) return;
  useShow.setState({openItemId: itemId, selectedTile: 0});
  refreshStageNext();
}

/** Selects a tile of the open item without outputting it. */
export function selectTile(index: number): void {
  useShow.setState({selectedTile: index});
}

function startServiceItem(itemId: ItemId): SingleLiveCommand | undefined {
  const live = useLive.getState();
  if ((live.lastStartedItemId ?? live.state?.layers.slide?.itemId) === itemId) {
    return;
  }
  if (
    !useShow
      .getState()
      .rows.some(row => row.id === itemId && row.kind !== 'header')
  ) {
    return;
  }
  const id = parseServiceItemId(itemId);
  return id.ok ? {type: 'item.start', itemId: id.value} : undefined;
}

/**
 * Outputs a media tile to the media layer. Returns false for other tiles.
 */
function outputOtherTile(cursor: TileCursor): boolean {
  const tile = tilesOf(cursor.itemId)[cursor.index];
  if (tile?.media === undefined) return false;
  beginOutputRequest();
  useShow.setState({openItemId: cursor.itemId, selectedTile: cursor.index});
  sendMediaOutput(tile.media, startServiceItem(cursor.itemId));
  return true;
}

/** Outputs a tile and shows it selected in the 장 panel. */
export function outputTile(cursor: TileCursor): void {
  if (tilesOf(cursor.itemId)[cursor.index]?.verse !== undefined) return;
  if (outputOtherTile(cursor)) return;
  const slide = stageSlideOf(cursor);
  if (!slide) return;
  const request = beginOutputRequest();
  const live = useLive.getState();
  const previousItem =
    live.lastStartedItemId ?? live.state?.layers.slide?.itemId;
  const row = useShow.getState().rows.find(row => row.id === cursor.itemId);
  useShow.setState({openItemId: cursor.itemId, selectedTile: cursor.index});
  if (
    isLibrarySource(useShow.getState(), cursor.itemId) &&
    previousItem !== cursor.itemId &&
    window.llp
  ) {
    outputLibraryTile(cursor, request, live.commandVersion).catch(
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not output the library song tile',
          detail: cause instanceof Error ? cause.message : String(cause),
        }),
    );
    return;
  }
  if (
    row?.kind === 'song' &&
    previousItem !== cursor.itemId &&
    (row.background !== undefined || row.problem === 'missing-background') &&
    window.llp !== undefined
  ) {
    outputSongTile({
      cursor,
      request,
      commandVersion: live.commandVersion,
      serviceId: useShow.getState().serviceId,
    }).catch((error: unknown) =>
      window.llp?.log.write({
        level: 'error',
        message: 'Could not output the song tile',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return;
  }
  const view = useShow.getState();
  const source = bibleSourceFor(view, cursor.itemId);
  const liveItemId = live.state?.layers.slide?.itemId ?? null;
  useShow.setState({
    liveBibleSource: bibleSourceFor(view, liveItemId),
    requestedBibleSource: source?.id === liveItemId ? null : source,
  });
  if (row?.kind === 'slides') {
    publishSlidesProjection(
      useShow.getState(),
      cursor.itemId,
      tilesOf(cursor.itemId),
    );
  }
  sendSlideOutput(
    source === null
      ? slide
      : {...slide, kind: 'bible', title: source.passage.displayRef},
    row?.kind === 'slides' || row?.kind === 'song' ? row.background : undefined,
    startServiceItem(cursor.itemId),
  );
  const passage =
    source?.passage ?? (row?.kind === 'bible' ? row.bible : undefined);
  if (passage !== undefined) {
    rememberBiblePassage(passage);
  }
}

/** Builds the same following item that the next-slide command will open. */
function stageSlideOf(cursor: TileCursor) {
  const view = useShow.getState();
  const next = nextTileAtLast(
    {live: cursor, openItemId: cursor.itemId, tilesOf},
    view.rows,
    atLastSlide,
  );
  const row =
    next?.itemId === cursor.itemId
      ? undefined
      : view.rows.find(entry => entry.id === next?.itemId);
  const tile =
    next === null || row === undefined || row.kind === 'header'
      ? undefined
      : tilesOf(next.itemId)[next.index];
  const after =
    next === null ? undefined : tilesOf(next.itemId)[next.index + 1];
  const following: Parameters<typeof slideLayerOf>[2] =
    tile === undefined || row === undefined || row.kind === 'header'
      ? undefined
      : {
          tile,
          kind:
            row.kind === 'slides'
              ? (tile.kind ?? 'blank')
              : row.kind === 'unknown'
                ? 'blank'
                : row.kind,
          title: row.title,
          ...(next === null
            ? {}
            : {
                textSlideNumber: noticeNumber(tilesOf(next.itemId), next.index),
              }),
          ...(after === undefined ? {} : {after}),
        };
  return slideLayerOf(cursor, tilesOf, following);
}

interface SongOutput {
  readonly cursor: TileCursor;
  readonly request: number;
  readonly commandVersion: number;
  readonly serviceId: string | null;
}

async function outputSongTile({
  cursor,
  request,
  commandVersion,
  serviceId,
}: SongOutput): Promise<void> {
  let service: ShowService | null = null;
  try {
    service = await withinLookupTimeout(
      () => window.llp?.service.get() ?? Promise.resolve(null),
    );
  } catch (error: unknown) {
    window.llp?.log.write({
      level: 'warn',
      message: 'Could not refresh the song background; using its cached choice',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  if (
    !isOutputRequestCurrent(request, commandVersion) ||
    serviceId !== useShow.getState().serviceId
  ) {
    return;
  }

  if (service !== null && service.id !== serviceId) return;

  if (service !== null && service.id === serviceId) applyService(service);
  const slide = stageSlideOf(cursor);
  if (!slide) return;
  const row = useShow.getState().rows.find(row => row.id === cursor.itemId);
  sendSlideOutput(
    slide,
    row?.kind === 'song' ? row.background : undefined,
    startServiceItem(cursor.itemId),
  );
}

function outputIfPresent(cursor: TileCursor | null): void {
  if (cursor) outputTile(cursor);
}

let atLastSlide: AtLastSlide = 'stop';

// NOTE(0913vision): The value follows the 진행 workspace: `useAtLastSlide`
// keeps it while that workspace is mounted, and nothing resets it on unmount.
/** Tells the next-장 key what to do on the last 장 (환경설정, applied at once). */
export function setAtLastSlide(value: AtLastSlide): void {
  atLastSlide = value;
  refreshStageNext();
}

// NOTE(0913vision): The marker suppresses only the same desired value; a new
// value still sends immediately, and matching live state clears the marker.
let pendingStageNext:
  | {api: typeof window.llp; itemId: string; position: number; key: string}
  | undefined;

function nextKey(next: NextSlide | null | undefined): string {
  return next == null
    ? 'null'
    : JSON.stringify([
        next.label,
        next.title ?? null,
        next.itemKind ?? null,
        next.lines,
        next.continued ?? null,
        next.biblePart ?? null,
        next.titleSlide ?? null,
      ]);
}

/** Keep stage preview in sync without re-outputting the live slide. */
function refreshStageNext(): void {
  const slide = useLive.getState().state?.layers.slide;
  if (slide === null || slide === undefined) return;
  const view = useShow.getState();
  const cursor = nextTileAtLast(sequenceState(), view.rows, atLastSlide);
  const tile =
    cursor === null ? undefined : tilesOf(cursor.itemId)[cursor.index];
  const row =
    cursor === null
      ? undefined
      : view.rows.find(entry => entry.id === cursor.itemId);
  const kind =
    row === undefined ||
    row.kind === 'header' ||
    cursor?.itemId === slide.itemId
      ? undefined
      : row.kind === 'slides'
        ? (tile?.kind ?? 'blank')
        : row.kind === 'unknown'
          ? 'blank'
          : row.kind;
  const afterCard =
    cursor === null ? undefined : tilesOf(cursor.itemId)[cursor.index + 1];
  const next =
    tile === undefined
      ? null
      : nextSlideOf(tile, kind, {
          title: row?.title,
          after: afterCard,
          textSlideNumber:
            cursor === null
              ? undefined
              : noticeNumber(tilesOf(cursor.itemId), cursor.index),
        });
  const key = nextKey(next);
  if (
    pendingStageNext !== undefined &&
    (pendingStageNext.api !== window.llp ||
      pendingStageNext.itemId !== slide.itemId ||
      pendingStageNext.position !== slide.position)
  ) {
    pendingStageNext = undefined;
  }
  if (
    pendingStageNext?.key === key ||
    (pendingStageNext === undefined && nextKey(slide.next) === key)
  ) {
    return;
  }
  pendingStageNext = {
    api: window.llp,
    itemId: slide.itemId,
    position: slide.position,
    key,
  };
  sendLive({
    type: 'stage.next.set',
    itemId: slide.itemId,
    position: slide.position,
    next,
  });
}

/**
 * Outputs the next 장. On the last 장 of an item it stops, or with 다음 항목
 * starts the next item on its first 장 and opens it in the 장 panel, the way
 * 다음 항목 and then → do.
 */
export function outputNext(): void {
  const cursor = nextTileAtLast(
    sequenceState(),
    useShow.getState().rows,
    atLastSlide,
  );
  if (cursor !== null && cursor.itemId !== liveCursor()?.itemId) {
    openItem(cursor.itemId);
  }
  outputIfPresent(cursor);
}

export function outputPrevious(): void {
  const cursor = previousTileAtFirst(
    previousSequenceState(),
    useShow.getState().rows,
    atLastSlide,
  );
  if (cursor !== null && cursor.itemId !== liveCursor()?.itemId) {
    openItem(cursor.itemId);
  }
  outputIfPresent(cursor);
}

/** Outputs the first or last tile of the open presentation without wrapping. */
export function outputBoundarySlide(boundary: 'first' | 'last'): void {
  const itemId = useShow.getState().openItemId;
  if (itemId === null) return;
  const tiles = tilesOf(itemId);
  if (tiles.length === 0) return;
  outputTile({itemId, index: boundary === 'first' ? 0 : tiles.length - 1});
}

/** True if the open presentation has a slide assigned to this physical hot key. */
export function hasSlideHotKey(code: string): boolean {
  const view = useShow.getState();
  const source = view.openItemId;
  if (!source) return false;
  return findSlideHotKey(tilesOf(source), code) !== null;
}

/** Outputs the first tile in the open presentation that has this physical hot key. */
export function outputHotKey(code: string): boolean {
  const view = useShow.getState();
  const source = view.openItemId;
  if (!source) return false;
  const target = findSlideHotKey(tilesOf(source), code);
  if (!target) return false;
  outputTile({itemId: source, index: target.tileIndex});
  return true;
}

function openAdjacentItem(direction: 'next' | 'previous'): void {
  const {rows, openItemId} = useShow.getState();
  const target = adjacentItem({
    rows,
    tilesOf,
    current: openItemId,
    direction,
  });
  if (target !== null) openItem(target);
}

/** 다음 항목: opens the next item that can output, without outputting. */
export function openNextItem(): void {
  openAdjacentItem('next');
}

/** 이전 항목: opens the previous item that can output, without outputting. */
export function openPreviousItem(): void {
  openAdjacentItem('previous');
}

/** 출력 중인 항목 열기: opens the item of the live 장 in the 장 panel. */
export function revealLiveItem(): void {
  const view = useShow.getState();
  const live = liveCursor();
  if (
    live &&
    (isLibrarySource(view, live.itemId) || isBibleSource(view, live.itemId))
  ) {
    openItem(live.itemId);
    return;
  }
  const target = liveItem({rows: view.rows, live, current: view.openItemId});
  if (target !== null) openItem(target);
}

function isStale(service: ShowService): boolean {
  const {revision, serviceId} = useShow.getState();
  return (
    revision !== null && serviceId === service.id && service.revision < revision
  );
}

function keptSelection(
  service: ShowService,
): Pick<ShowView, 'openItemId' | 'selectedTile'> {
  const view = useShow.getState();
  const {openItemId, selectedTile} = view;
  if (isLibrarySource(view, openItemId) || isBibleSource(view, openItemId)) {
    return {openItemId, selectedTile};
  }
  const stillThere =
    openItemId !== null && service.rows.some(row => row.id === openItemId);
  if (!stillThere) return {openItemId: null, selectedTile: 0};
  const last = Math.max(0, (service.tiles[openItemId]?.length ?? 0) - 1);
  return {openItemId, selectedTile: Math.min(selectedTile, last)};
}

/**
 * Shows the open 예배 순서 the main process sent, or none when it is null. A
 * revision older than the one shown is dropped. The open item and the selected
 * tile stay when the item is still there.
 */
export function applyService(service: ShowService | null): void {
  if (service === null) {
    const view = useShow.getState();
    const {openItemId, selectedTile} = view;
    const keepSource =
      isLibrarySource(view, openItemId) || isBibleSource(view, openItemId);
    useShow.setState({
      ...noService,
      openItemId: keepSource ? openItemId : null,
      selectedTile: keepSource ? selectedTile : 0,
    });
    return;
  }
  if (isStale(service)) return;
  useShow.setState({
    revision: service.revision,
    serviceId: service.id,
    serviceName: service.name,
    readOnly: service.readOnly,
    rows: service.rows,
    tiles: service.tiles,
    jumpKeys: service.jumpKeys,
    ...keptSelection(service),
  });
  refreshStageNext();
}

/**
 * Starts mirroring the open 예배 순서 of the main process. The first read is
 * dropped when a push already arrived, because the push is newer, and nothing
 * changes the state after the returned function was called.
 *
 * @returns A function that stops mirroring. Always call it.
 */
export function startServiceSync(): () => void {
  const api = window.llp;
  if (api === undefined) return () => undefined;
  let stopped = false;
  let pushed = false;
  const unsubscribeLive = useLive.subscribe((next, previous) => {
    const current = next.state?.layers.slide;
    const before = previous.state?.layers.slide;
    if (
      pendingStageNext !== undefined &&
      current?.itemId === pendingStageNext.itemId &&
      pendingStageNext.position === current.position &&
      pendingStageNext.key === nextKey(current.next)
    ) {
      pendingStageNext = undefined;
    }
    if (
      current !== null &&
      current !== undefined &&
      (current.itemId !== before?.itemId ||
        current.position !== before.position)
    ) {
      refreshStageNext();
    }
  });
  const unsubscribe = api.service.subscribe(service => {
    if (stopped) return;
    pushed = true;
    applyService(service);
  });
  api.service.get().then(
    service => {
      if (stopped || pushed) return;
      applyService(service);
    },
    // NOTE(0913vision): The preload logs a failed or malformed read before it
    // rejects, so the view just stays as it is.
    () => undefined,
  );
  return () => {
    stopped = true;
    unsubscribeLive();
    unsubscribe();
  };
}
