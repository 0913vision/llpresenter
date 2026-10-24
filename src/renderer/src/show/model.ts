import type {LabelColor} from '@shared/colors';

/** Id of a row in the 예배 순서 (service order). */
export type ItemId = string;

export type ItemKind = 'song' | 'bible' | 'media' | 'notice' | 'slot';

export interface HeaderRow {
  readonly kind: 'header';
  readonly id: ItemId;
  readonly title: string;
}

export interface ItemRow {
  readonly kind: ItemKind;
  readonly id: ItemId;
  readonly title: string;
}

export type ServiceRow = HeaderRow | ItemRow;

/** One tile of the 장 grid: a 장 at its position in the 구성 (arrangement). */
export interface SlideTile {
  readonly label: string | null;
  /** The 이름표 color, or `none` when the 이름표 has no color. */
  readonly labelColor: LabelColor;
  readonly lines: readonly string[];
}

/** Where a tile sits: an item and the tile's index in the item's sequence. */
export interface TileCursor {
  readonly itemId: ItemId;
  readonly index: number;
}

export function isItemRow(row: ServiceRow): row is ItemRow {
  return row.kind !== 'header';
}
