import type {
  ShowRow,
  ShowTile,
  showRowProblems,
} from '@core/schema/services/showService';

/** Id of a row in the 예배 순서 (service order). */
export type ItemId = string;

/** Why a row shows a warning; the data layer decides it. */
export type RowProblem = (typeof showRowProblems)[number];

/**
 * The kinds of 예배 순서 items, which is every row kind except a section header.
 */
export type ItemKind = Exclude<ShowRow['kind'], 'header'>;

/** A section header row of the 예배 순서. */
export interface HeaderRow {
  readonly kind: 'header';
  readonly id: ItemId;
  readonly title: string;
}

/** A row of the 예배 순서 that is an item and not a header. */
export type ItemRow = Exclude<ShowRow, {kind: 'header'}>;

/** A row of the 예배 순서: a section header or an item. */
export type ServiceRow = HeaderRow | ItemRow;

/** One tile of the 장 grid at its position in the slide sequence. */
export type SlideTile = ShowTile;

/** Where a tile sits: an item and the tile's index in the item's sequence. */
export interface TileCursor {
  readonly itemId: ItemId;
  readonly index: number;
}

/** Whether the row is an item and not a section header. */
export function isItemRow(row: ServiceRow): row is ItemRow {
  return row.kind !== 'header';
}
