import {
  isItemRow,
  type ItemId,
  type ItemRow,
  type ServiceRow,
  type SlideTile,
  type TileCursor,
} from './model';

export type TilesOf = (itemId: ItemId) => readonly SlideTile[];

export type ItemDirection = 'next' | 'previous';

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

function canOutput(row: ServiceRow, tilesOf: TilesOf): row is ItemRow {
  return isItemRow(row) && row.kind !== 'slot' && tilesOf(row.id).length > 0;
}

/**
 * The item that 다음 항목 or 이전 항목 opens: the next or previous item that
 * can output, skipping headers, slots, and items without a 장. With no item
 * open, next gives the first such item and previous gives nothing. At the ends
 * of the list it gives nothing, so the selection stays.
 */
export function adjacentItem(params: {
  readonly rows: readonly ServiceRow[];
  readonly tilesOf: TilesOf;
  readonly current: ItemId | null;
  readonly direction: ItemDirection;
}): ItemId | null {
  const {rows, tilesOf, current, direction} = params;
  const candidates = rows.filter(row => canOutput(row, tilesOf));
  if (current === null) {
    return direction === 'next' ? (candidates[0]?.id ?? null) : null;
  }
  const at = rows.findIndex(row => row.id === current);
  if (at === -1) return null;
  const searched =
    direction === 'next' ? rows.slice(at + 1) : rows.slice(0, at).reverse();
  return searched.find(row => canOutput(row, tilesOf))?.id ?? null;
}

/**
 * The item that 출력 중인 항목 열기 opens: the item of the live 장, when it
 * is in the list and is not the open item already.
 */
export function liveItem(params: {
  readonly rows: readonly ServiceRow[];
  readonly live: TileCursor | null;
  readonly current: ItemId | null;
}): ItemId | null {
  const {rows, live, current} = params;
  if (!live || live.itemId === current) return null;
  return rows.some(row => row.id === live.itemId) ? live.itemId : null;
}
