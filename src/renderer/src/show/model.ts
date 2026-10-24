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

export type LabelColor =
  'teal' | 'green' | 'yellow' | 'orange' | 'rose' | 'violet' | 'slate' | 'gray';

/** One tile of the 장 grid: a 장 at its position in the 구성 (arrangement). */
export interface SlideTile {
  readonly label: string | null;
  /** The 이름표 color. Null when the 이름표 has none. */
  readonly labelColor: LabelColor | null;
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
