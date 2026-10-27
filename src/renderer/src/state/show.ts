import {findSlideHotKey} from '@shared/slideHotKeys';
import {parseServiceItemId} from '@shared/schema/ids';
import type {ShowService} from '@shared/schema/showService';
import {
  type ItemId,
  type SlideTile,
  type TileCursor,
} from '@renderer/show/model';
import {
  adjacentItem,
  liveItem,
  nextTile,
  previousTile,
  tileForLabel,
  type SequenceState,
} from '@renderer/show/navigation';
import {slideLayerOf} from '@renderer/show/slideLayer';
import {rememberBibleOutput} from '@renderer/show/bible/recentWriter';
import {sendLive, useLive} from './live';
import {
  bibleSourceFor,
  isBibleSource,
  isLibrarySource,
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

declare global {
  interface Window {
    __llpShowStore?: typeof useShow;
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__llpShowStore = useShow;
}

export function tilesOf(itemId: ItemId): readonly SlideTile[] {
  return tilesForView(useShow.getState(), itemId);
}

/** The tile on output, taken from the live slide layer. */
export function liveCursor(): TileCursor | null {
  const slide = useLive.getState().state?.layers.slide;
  return slide ? {itemId: slide.itemId, index: slide.position} : null;
}

function sequenceState(): SequenceState {
  const {openItemId} = useShow.getState();
  return {tilesOf, live: liveCursor(), openItemId};
}

/**
 * Opens an item in the 장 panel and selects its first tile. Opening the item
 * that is already open keeps its tile selection.
 */
export function openItem(itemId: ItemId): void {
  if (useShow.getState().openItemId === itemId) return;
  useShow.setState({openItemId: itemId, selectedTile: 0});
}

/** Selects a tile of the open item without outputting it. */
export function selectTile(index: number): void {
  useShow.setState({selectedTile: index});
}

function startServiceItem(itemId: ItemId): void {
  const live = useLive.getState();
  if ((live.lastSlideItemId ?? live.state?.layers.slide?.itemId) === itemId) {
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
  if (id.ok) sendLive({type: 'item.start', itemId: id.value});
}

/** Outputs a tile and shows it selected in the 장 panel. */
export function outputTile(cursor: TileCursor): void {
  const slide = slideLayerOf(cursor, tilesOf);
  if (!slide) return;
  const request = beginOutputRequest();
  const live = useLive.getState();
  const previousItem = live.lastSlideItemId ?? live.state?.layers.slide?.itemId;
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
  startServiceItem(cursor.itemId);
  sendLive({type: 'slide.show', slide});
  if (source !== null) {
    rememberBibleOutput(source.passage);
  }
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
      message: 'Could not refresh the song background; kept the current media',
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
  const slide = slideLayerOf(cursor, tilesOf);
  if (!slide) return;
  const row =
    service?.id === serviceId
      ? useShow.getState().rows.find(row => row.id === cursor.itemId)
      : undefined;
  startServiceItem(cursor.itemId);
  if (row?.kind === 'song' && row.background !== undefined) {
    const current = useLive.getState().state?.layers.media;
    if (
      current?.mediaId !== row.background.mediaId ||
      current.loop !== row.background.loop
    ) {
      sendLive({type: 'media.show', media: row.background});
    }
  }
  sendLive({type: 'slide.show', slide});
}

function outputIfPresent(cursor: TileCursor | null): void {
  if (cursor) outputTile(cursor);
}

export function outputNext(): void {
  outputIfPresent(nextTile(sequenceState()));
}

export function outputPrevious(): void {
  outputIfPresent(previousTile(sequenceState()));
}

export function jumpLabelFor(code: string): string | undefined {
  const view = useShow.getState();
  const source = liveCursor()?.itemId ?? view.openItemId;
  if (isLibrarySource(view, source)) {
    return view.librarySong.jumpKeys[code];
  }
  return view.jumpKeys[code];
}

/** True if the active presentation has a slide assigned to this physical hot key. */
export function hasSlideHotKey(code: string): boolean {
  const view = useShow.getState();
  const source = liveCursor()?.itemId ?? view.openItemId;
  if (!source) return false;
  return findSlideHotKey(tilesOf(source), code) !== null;
}

/** Outputs the first tile in the active presentation that has this physical hot key. */
export function outputHotKey(code: string): boolean {
  const view = useShow.getState();
  const source = liveCursor()?.itemId ?? view.openItemId;
  if (!source) return false;
  const target = findSlideHotKey(tilesOf(source), code);
  if (!target) return false;
  outputTile({itemId: source, index: target.tileIndex});
  return true;
}

/** Outputs the first tile with an 이름표 after the live 장, or the first in the sequence. */
export function outputLabel(label: string): void {
  outputIfPresent(tileForLabel(sequenceState(), label));
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
    unsubscribe();
  };
}
