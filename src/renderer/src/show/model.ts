import type {MediaChoice} from '@shared/live';
import type {RecentPassage} from '@shared/schema/bible';
import type {ShowTile, showRowProblems} from '@shared/schema/showService';

/** Id of a row in the 예배 순서 (service order). */
export type ItemId = string;

/** Why a row shows a warning; the data layer decides it. */
export type RowProblem = (typeof showRowProblems)[number];

export type ItemKind = 'song' | 'bible' | 'media' | 'notice' | 'unknown';

export interface HeaderRow {
  readonly kind: 'header';
  readonly id: ItemId;
  readonly title: string;
}

export interface ItemRow {
  readonly kind: ItemKind;
  readonly id: ItemId;
  readonly title: string;
  readonly problem?: RowProblem;
  readonly background?: MediaChoice;
  readonly bible?: RecentPassage;
}

export type ServiceRow = HeaderRow | ItemRow;

/** One tile of the 장 grid: a 장 at its position in the 구성 (arrangement). */
export type SlideTile = ShowTile;

/** Where a tile sits: an item and the tile's index in the item's sequence. */
export interface TileCursor {
  readonly itemId: ItemId;
  readonly index: number;
}

export function isItemRow(row: ServiceRow): row is ItemRow {
  return row.kind !== 'header';
}
