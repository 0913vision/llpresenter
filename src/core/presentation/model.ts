import type {
  ShowRow,
  ShowTile,
  showRowProblems,
} from '@core/schema/services/showService';

/** Id of a row in the 예배 순서 (service order). */
export type ItemId = string;

/** Why a row shows a warning; the data layer decides it. */
export type RowProblem = (typeof showRowProblems)[number];

export type ItemKind = Exclude<ShowRow['kind'], 'header'>;

export interface HeaderRow {
  readonly kind: 'header';
  readonly id: ItemId;
  readonly title: string;
}

export type ItemRow = Exclude<ShowRow, {kind: 'header'}>;

export type ServiceRow = HeaderRow | ItemRow;

/** One tile of the 장 grid at its position in the slide sequence. */
export type SlideTile = ShowTile;

/** Where a tile sits: an item and the tile's index in the item's sequence. */
export interface TileCursor {
  readonly itemId: ItemId;
  readonly index: number;
}

export function isItemRow(row: ServiceRow): row is ItemRow {
  return row.kind !== 'header';
}
