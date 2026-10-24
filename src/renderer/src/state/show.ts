import {create} from 'zustand';
import type {SlideLayer} from '@shared/live';
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
  type RowKey,
  type SequenceState,
  type TileKey,
} from '@renderer/show/navigation';
import {sampleRows, sampleTiles} from '@renderer/show/sampleService';
import {sendLive, useLive} from './live';

interface ShowView {
  readonly rows: readonly ServiceRow[];
  readonly tiles: Readonly<Record<ItemId, readonly SlideTile[]>>;
  /** The item open in the 장 panel. */
  readonly openItemId: ItemId | null;
  /** The selected tile of the open item. */
  readonly selectedTile: number;
}

const noTiles: readonly SlideTile[] = [];

export const useShow = create<ShowView>(() => ({
  rows: sampleRows,
  tiles: sampleTiles,
  openItemId: null,
  selectedTile: 0,
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

function slideLayerOf(cursor: TileCursor): SlideLayer | null {
  const tile = tilesOf(cursor.itemId)[cursor.index];
  if (!tile) return null;
  return {
    itemId: cursor.itemId,
    position: cursor.index,
    label: tile.label,
    lines: tile.lines,
  };
}

/** Outputs a tile and shows it selected in the 장 panel. */
export function outputTile(cursor: TileCursor): void {
  const slide = slideLayerOf(cursor);
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
