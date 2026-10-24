import {useMemo} from 'react';
import {create} from 'zustand';
import type {SlideLayer} from '@shared/live';
import {sizeClasses} from '@shared/schema/appConfig';
import {COLUMN_LIMITS, type UiState} from '@shared/schema/uiState';
import {
  type ItemId,
  type ServiceRow,
  type SlideTile,
  type TileCursor,
} from '@renderer/show/model';
import {
  moveRowSelection,
  moveTileSelection,
  nextTile,
  previousTile,
  tileForLabel,
  type RowKey,
  type SequenceState,
  type TileKey,
} from '@renderer/show/navigation';
import {slideLayerOf} from '@renderer/show/previewLayers';
import {
  sampleJumpKeys,
  sampleRows,
  sampleTiles,
} from '@renderer/show/sampleService';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/shell/sizeClass';
import {sendLive, useLive} from './live';

interface ShowView {
  readonly rows: readonly ServiceRow[];
  readonly tiles: Readonly<Record<ItemId, readonly SlideTile[]>>;
  /** The item open in the 장 panel. */
  readonly openItemId: ItemId | null;
  /** The selected tile of the open item. */
  readonly selectedTile: number;
  readonly thumbnailColumns: Readonly<Partial<Record<SizeClass, number>>>;
  /** 이름표 jump keys: a physical key (`KeyboardEvent.code`) to an 이름표 name. */
  readonly jumpKeys: Readonly<Record<string, string>>;
}

const noTiles: readonly SlideTile[] = [];

export const useShow = create<ShowView>(() => ({
  rows: sampleRows,
  tiles: sampleTiles,
  openItemId: null,
  selectedTile: 0,
  thumbnailColumns: {},
  jumpKeys: sampleJumpKeys,
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

export function moveRow(key: RowKey): void {
  const {rows, openItemId} = useShow.getState();
  const target = moveRowSelection(rows, openItemId, key);
  if (target !== null && target !== openItemId) openItem(target);
}

function selectTile(index: number): void {
  useShow.setState({selectedTile: index});
}

export function moveTile(key: TileKey, columns: number): void {
  const {openItemId, selectedTile} = useShow.getState();
  if (openItemId === null) return;
  const index = moveTileSelection({
    count: tilesOf(openItemId).length,
    columns,
    index: selectedTile,
    key,
  });
  selectTile(index);
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

/**
 * The 장 that the next-장 key would output, for the "next" preview. It follows
 * the live 장, the open item, and the tiles, and changes only with them.
 */
export function useNextSlideLayer(): SlideLayer | null {
  const liveItemId = useLive(view => view.state?.layers.slide?.itemId ?? null);
  const livePosition = useLive(
    view => view.state?.layers.slide?.position ?? null,
  );
  const openItemId = useShow(view => view.openItemId);
  const tiles = useShow(view => view.tiles);
  return useMemo(() => {
    const tilesOfItem = (itemId: ItemId): readonly SlideTile[] =>
      tiles[itemId] ?? noTiles;
    const live =
      liveItemId === null || livePosition === null
        ? null
        : {itemId: liveItemId, index: livePosition};
    const next = nextTile({tilesOf: tilesOfItem, live, openItemId});
    return next ? slideLayerOf(next, tilesOfItem) : null;
  }, [liveItemId, livePosition, openItemId, tiles]);
}
