import {create} from 'zustand';
import type {ShowService} from '@shared/schema/showService';
import {sizeClasses} from '@shared/schema/appConfig';
import {COLUMN_LIMITS, type UiState} from '@shared/schema/uiState';
import {
  type ItemId,
  type ServiceRow,
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
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {sendLive, useLive} from './live';

interface ShowView {
  // NOTE(0913vision): The revision is null while no service is open.
  readonly revision: number | null;
  readonly serviceId: string | null;
  readonly serviceName: string;
  // NOTE(0913vision): A read-only service comes from a newer app version.
  readonly readOnly: boolean;
  readonly rows: readonly ServiceRow[];
  readonly tiles: Readonly<Record<ItemId, readonly SlideTile[]>>;
  readonly openItemId: ItemId | null;
  readonly selectedTile: number;
  readonly thumbnailColumns: Readonly<Partial<Record<SizeClass, number>>>;
  // NOTE(0913vision): Jump keys map a physical key (`KeyboardEvent.code`) to an
  // 이름표 name.
  readonly jumpKeys: Readonly<Record<string, string>>;
}

const noTiles: readonly SlideTile[] = [];

const noService = {
  revision: null,
  serviceId: null,
  serviceName: '',
  readOnly: false,
  rows: [],
  tiles: {},
  jumpKeys: {},
} as const satisfies Partial<ShowView>;

export const useShow = create<ShowView>(() => ({
  ...noService,
  openItemId: null,
  selectedTile: 0,
  thumbnailColumns: {},
}));

export function tilesOf(itemId: ItemId): readonly SlideTile[] {
  return useShow.getState().tiles[itemId] ?? noTiles;
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

/** Opens an item in the 장 panel and selects its first tile. */
export function openItem(itemId: ItemId): void {
  useShow.setState({openItemId: itemId, selectedTile: 0});
}

/** Selects a tile of the open item without outputting it. */
export function selectTile(index: number): void {
  useShow.setState({selectedTile: index});
}

/** Outputs a tile and shows it selected in the 장 panel. */
export function outputTile(cursor: TileCursor): void {
  const slide = slideLayerOf(cursor, tilesOf);
  if (!slide) return;
  sendLive({type: 'slide.show', slide});
  useShow.setState({openItemId: cursor.itemId, selectedTile: cursor.index});
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
  return useShow.getState().jumpKeys[code];
}

/** Outputs the first tile with an 이름표 after the live 장, or the first in the sequence. */
export function outputLabel(label: string): void {
  outputIfPresent(tileForLabel(sequenceState(), label));
}

export const MIN_THUMBNAIL_COLUMNS = COLUMN_LIMITS.columns.min;
export const MAX_THUMBNAIL_COLUMNS = COLUMN_LIMITS.columns.max;

function clampColumns(columns: number): number {
  return Math.min(
    Math.max(Math.round(columns), MIN_THUMBNAIL_COLUMNS),
    MAX_THUMBNAIL_COLUMNS,
  );
}

function columnsOf(view: ShowView, sizeClass: SizeClass): number {
  return view.thumbnailColumns[sizeClass] ?? defaultThumbnailColumns[sizeClass];
}

/** The columns of the 장 grid for a size class: the chosen number, or the default. */
export function useThumbnailColumns(sizeClass: SizeClass): number {
  return useShow(view => columnsOf(view, sizeClass));
}

/**
 * Sets the columns of a size class and sends the new number to the main
 * process, which saves it in `app.json`. A number that is already in effect
 * changes and sends nothing.
 */
export function setThumbnailColumns(
  sizeClass: SizeClass,
  columns: number,
): void {
  const clamped = clampColumns(columns);
  if (clamped === columnsOf(useShow.getState(), sizeClass)) return;
  useShow.setState(view => ({
    thumbnailColumns: {...view.thumbnailColumns, [sizeClass]: clamped},
  }));
  window.llp?.ui.setLayout({sizeClass, columns: clamped});
}

/** Takes the saved columns of every size class from the UI state. Sends nothing. */
export function seedThumbnailColumns(uiState: UiState): void {
  const saved: Partial<Record<SizeClass, number>> = {};
  for (const sizeClass of sizeClasses) {
    const columns = uiState.layout?.[sizeClass]?.columns;
    if (columns !== undefined) saved[sizeClass] = clampColumns(columns);
  }
  useShow.setState({thumbnailColumns: saved});
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
  const {rows, openItemId} = useShow.getState();
  const target = liveItem({rows, live: liveCursor(), current: openItemId});
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
  const {openItemId, selectedTile} = useShow.getState();
  const stillThere =
    openItemId !== null &&
    service.rows.some(row => row.id === openItemId && row.kind !== 'header');
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
    useShow.setState({...noService, openItemId: null, selectedTile: 0});
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
