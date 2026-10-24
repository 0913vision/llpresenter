import {
  isItemRow,
  type ItemId,
  type ItemRow,
  type ServiceRow,
  type SlideTile,
  type TileCursor,
} from './model';

export type RowKey = 'up' | 'down' | 'home' | 'end';
export type TileKey = 'up' | 'down';

export type TilesOf = (itemId: ItemId) => readonly SlideTile[];

function selectableRows(rows: readonly ServiceRow[]): readonly ItemRow[] {
  return rows.filter(isItemRow);
}

/**
 * The row to select after an up, down, Home, or End key. Headers are skipped.
 * Up and down stop at the ends of the list.
 */
export function moveRowSelection(
  rows: readonly ServiceRow[],
  current: ItemId | null,
  key: RowKey,
): ItemId | null {
  const items = selectableRows(rows);
  if (items.length === 0) return null;
  if (key === 'home') return items[0]?.id ?? null;
  if (key === 'end') return items.at(-1)?.id ?? null;
  const at = items.findIndex(item => item.id === current);
  if (at === -1) return key === 'down' ? (items[0]?.id ?? null) : null;
  const step = key === 'down' ? 1 : -1;
  const target = Math.min(Math.max(at + step, 0), items.length - 1);
  return items[target]?.id ?? null;
}

/**
 * The tile index after the up or down arrow in a grid with the given number of
 * columns. The selection moves by one row, stays inside the grid, and does not
 * wrap around. ← and → are not grid keys: they output the previous and next 장.
 */
export function moveTileSelection(params: {
  readonly count: number;
  readonly columns: number;
  readonly index: number;
  readonly key: TileKey;
}): number {
  const {count, columns, index, key} = params;
  if (count === 0) return 0;
  const target = key === 'down' ? index + columns : index - columns;
  return target < 0 || target >= count ? index : target;
}

export interface SequenceState {
  readonly tilesOf: TilesOf;
  /** The tile on output, or null when no 장 is live. */
  readonly live: TileCursor | null;
  /** The item open in the 장 panel, or null when none is open. */
  readonly openItemId: ItemId | null;
}

function firstTileOf(itemId: ItemId, tilesOf: TilesOf): TileCursor | null {
  return tilesOf(itemId).length > 0 ? {itemId, index: 0} : null;
}

/**
 * The tile that the next-장 key outputs. When the 장 panel shows an item other
 * than the live one, or no 장 is live, it is the first tile of the open item.
 * Otherwise it is the tile after the live one, and null after the last tile:
 * the key stops there and does not move on to the next item.
 */
export function nextTile(state: SequenceState): TileCursor | null {
  const {live, openItemId, tilesOf} = state;
  if (openItemId !== null && live?.itemId !== openItemId) {
    return firstTileOf(openItemId, tilesOf);
  }
  if (!live) return null;
  if (live.index + 1 >= tilesOf(live.itemId).length) return null;
  return {itemId: live.itemId, index: live.index + 1};
}

/** The tile that the previous-장 key outputs. Null on the first tile. */
export function previousTile(state: SequenceState): TileCursor | null {
  const {live} = state;
  if (!live || live.index === 0) return null;
  return {itemId: live.itemId, index: live.index - 1};
}

/**
 * The tile that an 이름표 (label) jump key outputs: the first tile with that
 * label after the live 장, or else the first one with that label in the
 * sequence.
 */
export function tileForLabel(
  state: SequenceState,
  label: string,
): TileCursor | null {
  const itemId = state.live?.itemId ?? state.openItemId;
  if (!itemId) return null;
  const tiles = state.tilesOf(itemId);
  const after = (state.live?.index ?? -1) + 1;
  const indexAfter = tiles.findIndex(
    (tile, index) => index >= after && tile.label === label,
  );
  const index =
    indexAfter === -1
      ? tiles.findIndex(tile => tile.label === label)
      : indexAfter;
  return index === -1 ? null : {itemId, index};
}
