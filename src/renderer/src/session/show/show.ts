import type {SingleLiveCommand} from '@core/schema/live/liveCommand';
import type {SlideLayer} from '@core/schema/live/live';
import {QUICK_BIBLE_TRANSITION} from '@core/bible';
import {
  type ItemId,
  type TileCursor,
  adjacentItem,
  liveItem,
  nextTileAtLast,
  previousTileAtFirst,
  type SequenceState,
  slideLayerOf,
} from '@core/presentation';
import {hidesNext} from '@core/slides';
import {parseServiceItemId} from '@core/schema/common/ids';
import type {Preferences} from '@core/schema/app/preferences';
import type {ShowService} from '@core/schema/services/showService';
import {rememberBiblePassage} from '@renderer/session/recentWriter';
import {themeOfTile, useThemes} from '@renderer/platform/documents/themes';
import {sendSlideOutput} from './itemOutput';
import {sendLive, useLive} from '../live';
import {liveSuccessor, rememberLiveAnchor} from './liveAnchor';
import {
  beginQuickPassage,
  finishQuickPassage,
  forgetQuickPassage,
  quickReturnCursor,
} from './quickReturn';
import {
  lastShownCursor,
  liveCursor,
  rememberShownTile,
  tilesOf,
} from './showCursor';
import {
  bibleSourceFor,
  isBibleSource,
  isLibrarySource,
  liveTileIndex,
  projectedLiveCursor,
} from './showLibrary';
import {beginOutputRequest} from './showOutput';
import {noService, useShow, type ShowView} from './showStore';
import {scrollGridToItem, scrolledSlideItem} from './visibleSlideItem';

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
      : (liveCursor() ?? lastShownCursor());
  return {tilesOf, live, openItemId: view.openItemId};
}

/** Resolves a live quick-run library slide to its service-order position. */
function previousSequenceState(): SequenceState {
  const state = sequenceState();
  const actual = liveCursor() ?? lastShownCursor();
  const view = useShow.getState();
  if (actual === null) return state;
  if (
    view.rows.some(row => row.kind !== 'header' && row.id === actual.itemId)
  ) {
    return {...state, live: actual};
  }
  return state;
}

/**
 * Opens an item in the 장 panel and selects its first tile. Opening the item
 * that is already open keeps its tile selection.
 */
export function openItem(itemId: ItemId): void {
  if (useShow.getState().openItemId === itemId) return;
  useShow.setState({openItemId: itemId, selectedTile: 0});
}

/**
 * Opens an item as the 예배 순서 and 다음 항목 do: in the 슬라이드 panel, and a
 * continuous grid scrolls to it.
 */
export function openItemOnGrid(itemId: ItemId): void {
  openItem(itemId);
  scrollGridToItem(itemId);
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

let atLastSlide: AtLastSlide = 'stop';

/** What an item outside the 예배 순서 is. */
function outsideItem(
  view: ShowView,
  itemId: ItemId,
): Pick<SlideLayer, 'kind' | 'title'> {
  const source = bibleSourceFor(view, itemId);
  if (source !== null) {
    return {kind: 'bible', title: source.passage.displayRef};
  }
  return isLibrarySource(view, itemId)
    ? {kind: 'song', title: view.librarySong.title}
    : {};
}

/** The slide that outputting a tile sends, with what comes after it. */
export function outputSlideOf(cursor: TileCursor): SlideLayer | null {
  const view = useShow.getState();
  const following = nextTileAtLast(
    {live: cursor, openItemId: cursor.itemId, tilesOf},
    view.rows,
    atLastSlide,
  );
  const slide = slideLayerOf(cursor, tilesOf, {theme: themeOfTile, following});
  return slide === null
    ? null
    : {...slide, ...outsideItem(view, cursor.itemId)};
}

/** Whether the item before one ends on a slide that shows nothing of it. */
export function isHiddenBeforeItem(itemId: ItemId): boolean {
  const before = previousTileAtFirst(
    {live: {itemId, index: 0}, openItemId: itemId, tilesOf},
    useShow.getState().rows,
    'nextItem',
  );
  if (before === null) return false;
  const tiles = tilesOf(before.itemId);
  return hidesNext(tiles[before.index]?.slide);
}

/** Outputs a tile and shows it selected in the 장 panel. */
export function outputTile(
  cursor: TileCursor,
  reverseTransition?: SlideLayer['reverseTransition'],
): void {
  const projected = outputSlideOf(cursor);
  if (projected === null) return;
  beginOutputRequest();
  const view = useShow.getState();
  const source = bibleSourceFor(view, cursor.itemId);
  const quickPassage =
    source?.transition?.kind === QUICK_BIBLE_TRANSITION.kind &&
    source.transition.dir === QUICK_BIBLE_TRANSITION.dir &&
    source.transition.sec === QUICK_BIBLE_TRANSITION.sec;
  if (quickPassage) beginQuickPassage();
  sendSlideOutput(
    reverseTransition === undefined
      ? projected
      : {...projected, reverseTransition},
    startServiceItem(cursor.itemId),
  );
  useShow.setState({openItemId: cursor.itemId, selectedTile: cursor.index});
  if (quickPassage) finishQuickPassage();
  const row = view.rows.find(entry => entry.id === cursor.itemId);
  const passage =
    source?.passage ??
    (row !== undefined && 'passage' in row ? row.passage : undefined);
  if (passage !== undefined) {
    rememberBiblePassage({ref: passage.ref, translation: passage.translation});
  }
}

function outputIfPresent(cursor: TileCursor | null): void {
  if (cursor) outputTile(cursor);
}

// NOTE(0913vision): The value follows the 진행 workspace: `useAtLastSlide`
// keeps it while that workspace is mounted, and nothing resets it on unmount.
/** Tells the next-장 key what to do on the last 장 (환경설정, applied at once). */
/** Goes back to what was on output before the quick passage. */
export function returnFromQuickPassage(): void {
  const cursor = quickReturnCursor();
  if (cursor === null) return;
  forgetQuickPassage();
  outputTile(cursor);
}

/**
 * Sets what the next step does at the last slide of an item, and redraws the
 * live slide.
 */
export function setAtLastSlide(value: AtLastSlide): void {
  atLastSlide = value;
  refreshLiveSlide();
}

function shownContent(slide: SlideLayer): string {
  const {
    transitionStartedAt: _started,
    reverseTransition: _reverse,
    ...own
  } = slide;
  return JSON.stringify(
    Object.entries(own).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

let sent: string | null = null;

/** Keeps the live slide, and the next text it shows, in step with its item. */
function refreshLiveSlide(): void {
  const slide = useLive.getState().state?.layers.slide ?? null;
  const cursor = projectedLiveCursor(useShow.getState(), slide);
  if (slide === null || cursor === null) {
    sent = null;
    return;
  }
  const now = outputSlideOf(cursor);
  if (now === null) return;
  const shown = shownContent(now);
  if (shown === shownContent(slide)) {
    sent = null;
    return;
  }
  if (sent === shown) return;
  sent = shown;
  sendLive({type: 'slide.update', slide: now});
}

/**
 * Outputs the next 장. On the last 장 of an item it stops, or with 다음 항목
 * starts the next item on its first 장 and opens it in the 장 panel, the way
 * 다음 항목 and then → do.
 */
export function outputNext(): void {
  const view = useShow.getState();
  const slide = useLive.getState().state?.layers.slide ?? null;
  const gone =
    slide !== null &&
    projectedLiveCursor(view, slide) === null &&
    (view.openItemId === null || view.openItemId === slide.itemId)
      ? liveSuccessor(view, slide)
      : null;
  const cursor =
    gone ?? nextTileAtLast(sequenceState(), view.rows, atLastSlide);
  const open =
    cursor !== null &&
    cursor.itemId !== liveCursor()?.itemId &&
    cursor.itemId !== view.openItemId;
  outputIfPresent(cursor);
  if (open) openItem(cursor.itemId);
}

/**
 * Puts the slide before the live one on output. At an item's first slide it
 * goes to the previous item's last slide when the step crosses items.
 */
export function outputPrevious(): void {
  const cursor = previousTileAtFirst(
    previousSequenceState(),
    useShow.getState().rows,
    atLastSlide,
  );
  if (cursor === null) return;
  outputTile(
    cursor,
    useLive.getState().state?.layers.slide?.transition ?? null,
  );
}

/** Outputs the first or last tile of the open presentation without wrapping. */
export function outputBoundarySlide(boundary: 'first' | 'last'): void {
  const itemId = useShow.getState().openItemId;
  if (itemId === null) return;
  const tiles = tilesOf(itemId);
  if (tiles.length === 0) return;
  outputTile({itemId, index: boundary === 'first' ? 0 : tiles.length - 1});
}

function hotKeyTile(code: string): TileCursor | null {
  const itemId = useShow.getState().openItemId;
  if (itemId === null) return null;
  const index = tilesOf(itemId).findIndex(tile => tile.slide.hotKey === code);
  return index < 0 ? null : {itemId, index};
}

/** True if the open presentation has a slide assigned to this physical hot key. */
export function hasSlideHotKey(code: string): boolean {
  return hotKeyTile(code) !== null;
}

/** Outputs the first tile in the open presentation that has this physical hot key. */
export function outputHotKey(code: string): boolean {
  const cursor = hotKeyTile(code);
  if (cursor === null) return false;
  outputTile(cursor);
  return true;
}

// NOTE(0913vision): A continuous grid shows every item; the one it scrolled
// to is where the operator is, and the item that opens is scrolled to as a
// click on its 예배 순서 row does.
function openAdjacentItem(direction: 'next' | 'previous'): void {
  const {rows, openItemId} = useShow.getState();
  const target = adjacentItem({
    rows,
    tilesOf,
    current: scrolledSlideItem() ?? openItemId,
    direction,
  });
  if (target !== null) openItemOnGrid(target);
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

/** The open item and the slide selected in it, after a change. */
function keptSelection(
  service: ShowService,
): Pick<ShowView, 'openItemId' | 'selectedTile'> {
  const view = useShow.getState();
  const {openItemId, selectedTile} = view;
  if (isLibrarySource(view, openItemId) || isBibleSource(view, openItemId)) {
    return {openItemId, selectedTile};
  }
  if (openItemId === null || !service.rows.some(row => row.id === openItemId)) {
    return {openItemId: null, selectedTile: 0};
  }
  const tiles = service.tiles[openItemId] ?? [];
  const selected = view.tiles[openItemId]?.[selectedTile]?.slide.id;
  const index = tiles.findIndex(tile => tile.slide.id === selected);
  return {
    openItemId,
    selectedTile:
      index >= 0
        ? index
        : Math.max(0, Math.min(selectedTile, tiles.length - 1)),
  };
}

/**
 * Shows the open 예배 순서 the main process sent, or none when it is null. A
 * revision older than the one shown is dropped. The open item and the selected
 * tile stay on same-service refreshes when the item is still there.
 */
export function applyService(service: ShowService | null): void {
  if (service === null) {
    const view = useShow.getState();
    const {openItemId, selectedTile} = view;
    const keepSource =
      view.serviceId === null &&
      (isLibrarySource(view, openItemId) || isBibleSource(view, openItemId));
    useShow.setState({
      ...noService,
      serviceEpoch: view.serviceEpoch + (view.serviceId === null ? 0 : 1),
      openItemId: keepSource ? openItemId : null,
      selectedTile: keepSource ? selectedTile : 0,
    });
    return;
  }
  if (isStale(service)) return;
  const view = useShow.getState();
  const changed = view.serviceId !== service.id;
  useShow.setState({
    revision: service.revision,
    serviceId: service.id,
    serviceEpoch: view.serviceEpoch + (changed ? 1 : 0),
    serviceName: service.name,
    readOnly: service.readOnly,
    rows: service.rows,
    tiles: service.tiles,
    ...(changed ? {openItemId: null, selectedTile: 0} : keptSelection(service)),
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
  const liveSlide = (): SlideLayer | null =>
    useLive.getState().state?.layers.slide ?? null;
  const stops = [
    useLive.subscribe((next, previous) => {
      rememberShownTile(next.state);
      const slide = next.state?.layers.slide;
      const before = previous.state?.layers.slide;
      if (slide === before) return;
      rememberLiveAnchor(useShow.getState(), slide ?? null);
      if (slide?.slideId !== before?.slideId) refreshLiveSlide();
    }),
    useShow.subscribe((next, previous) => {
      if (
        next.tiles === previous.tiles &&
        next.rows === previous.rows &&
        next.librarySong === previous.librarySong &&
        next.bibleSources === previous.bibleSources
      ) {
        return;
      }
      rememberLiveAnchor(next, liveSlide());
      refreshLiveSlide();
    }),
    useThemes.subscribe(refreshLiveSlide),
    api.service.subscribe(service => {
      if (stopped) return;
      pushed = true;
      applyService(service);
    }),
  ];
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
    for (const stop of stops) stop();
  };
}
