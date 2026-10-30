import type {CheckState} from '@renderer/ui/Checkbox';
import type {ServiceItemId} from '@core/schema/ids';
import {
  isItemOfKind,
  serviceItemKind,
  type ServiceItem,
} from '@core/schema/service';

/** One row of the 예배 순서 tree in the service dialogs. */
export interface TreeRow {
  readonly id: ServiceItemId;
  readonly header: boolean;
  readonly label: string;
  /** The item's 16px kind icon, as the 예배 순서 list draws it. */
  readonly icon?: string | undefined;
  /** The chosen 구성 of a song, such as 주일용. */
  readonly detail?: string | undefined;
  /** The header the row sits under, if any. */
  readonly headerId?: ServiceItemId | undefined;
}

/** The checked rows by id: items, and headers with no items under them. */
export type TreeSelection = ReadonlySet<ServiceItemId>;

const DEFAULT_ARRANGEMENT = '기본';
const MISSING_SONG = '곡을 찾을 수 없음';
const kindLabels = {
  media: '미디어',
  notice: '공지',
  unknown: '알 수 없는 항목',
} as const;
// NOTE(0913vision): The same icons as the 예배 순서 list (show/ServiceOrderList).
const icons = {
  song: 'song',
  bible: 'book',
  media: 'film',
  notice: 'notice',
  unknown: 'filex',
} as const;

function rowOf(
  item: ServiceItem,
  songTitles: ReadonlyMap<string, string>,
): Pick<TreeRow, 'label' | 'icon' | 'detail'> {
  if (isItemOfKind(item, 'header')) return {label: item.header};
  if (isItemOfKind(item, 'song')) {
    return {
      label: songTitles.get(item.song) ?? MISSING_SONG,
      icon: icons.song,
      detail: item.arrangement ?? DEFAULT_ARRANGEMENT,
    };
  }
  if (isItemOfKind(item, 'bible')) {
    return {label: item.bible.ref, icon: icons.bible};
  }
  const kind = serviceItemKind(item);
  return kind === 'media' || kind === 'notice'
    ? {label: kindLabels[kind], icon: icons[kind]}
    : {label: kindLabels.unknown, icon: icons.unknown};
}

/** The rows of a 예배 순서 or 템플릿, each item under the header before it. */
export function treeRows(
  order: readonly ServiceItem[],
  songTitles: ReadonlyMap<string, string>,
): readonly TreeRow[] {
  let headerId: ServiceItemId | undefined;
  return order.map(item => {
    const header = isItemOfKind(item, 'header');
    if (header) headerId = item.id;
    return {
      id: item.id,
      header,
      ...rowOf(item, songTitles),
      ...(header || headerId === undefined ? {} : {headerId}),
    };
  });
}

/** Where a row sits in the tree, for `aria-level`, `aria-posinset`, and `aria-setsize`. */
export interface TreePosition {
  /** 1 for headers and items with no header, 2 for items under a header. */
  readonly level: number;
  readonly position: number;
  readonly size: number;
}

interface TreeShape {
  readonly children: ReadonlyMap<ServiceItemId, readonly ServiceItemId[]>;
  readonly checkable: readonly ServiceItemId[];
  readonly positions: ReadonlyMap<ServiceItemId, TreePosition>;
}

// NOTE(0913vision): Each rows array is read once, so rendering and keys stay
// linear in the number of rows. The hooks keep the array while its order is
// the same, and a new array gets a new shape. `checkable` is a full
// selection: every item, and every header with no items under it.
const shapes = new WeakMap<readonly TreeRow[], TreeShape>();

function buildShape(rows: readonly TreeRow[]): TreeShape {
  const children = new Map<ServiceItemId, ServiceItemId[]>();
  const levels = new Map<ServiceItemId | undefined, ServiceItemId[]>();
  for (const row of rows) {
    if (row.header) children.set(row.id, []);
    if (row.headerId !== undefined) children.get(row.headerId)?.push(row.id);
    const siblings = levels.get(row.headerId) ?? [];
    siblings.push(row.id);
    levels.set(row.headerId, siblings);
  }
  const positions = new Map<ServiceItemId, TreePosition>();
  for (const [headerId, siblings] of levels) {
    siblings.forEach((id, index) => {
      positions.set(id, {
        level: headerId === undefined ? 1 : 2,
        position: index + 1,
        size: siblings.length,
      });
    });
  }
  const checkable = rows
    .filter(row => !row.header || children.get(row.id)?.length === 0)
    .map(row => row.id);
  return {children, checkable, positions};
}

function shapeOf(rows: readonly TreeRow[]): TreeShape {
  const cached = shapes.get(rows);
  if (cached !== undefined) return cached;
  const shape = buildShape(rows);
  shapes.set(rows, shape);
  return shape;
}

function childrenOf(
  rows: readonly TreeRow[],
  headerId: ServiceItemId,
): readonly ServiceItemId[] {
  return shapeOf(rows).children.get(headerId) ?? [];
}

/** Where a row sits among the rows at its level. */
export function treePosition(
  rows: readonly TreeRow[],
  row: TreeRow,
): TreePosition {
  return (
    shapeOf(rows).positions.get(row.id) ?? {level: 1, position: 1, size: 1}
  );
}

function stateOf(
  ids: readonly ServiceItemId[],
  selection: TreeSelection,
): CheckState {
  const checked = ids.filter(id => selection.has(id)).length;
  if (checked === 0) return false;
  return checked === ids.length ? true : 'mixed';
}

/** A row's box: an item's own state, or a header's from its items. */
export function rowState(
  rows: readonly TreeRow[],
  row: TreeRow,
  selection: TreeSelection,
): CheckState {
  if (!row.header) return selection.has(row.id);
  const children = childrenOf(rows, row.id);
  return children.length === 0
    ? selection.has(row.id)
    : stateOf(children, selection);
}

/** The check-all box's state. */
export function allState(
  rows: readonly TreeRow[],
  selection: TreeSelection,
): CheckState {
  return stateOf(shapeOf(rows).checkable, selection);
}

/** Checks or unchecks a row; a header with items checks or unchecks them all. */
export function toggleRow({
  rows,
  row,
  on,
  selection,
}: {
  readonly rows: readonly TreeRow[];
  readonly row: TreeRow;
  readonly on: boolean;
  readonly selection: TreeSelection;
}): TreeSelection {
  const children = row.header ? childrenOf(rows, row.id) : [];
  const ids = children.length === 0 ? [row.id] : children;
  const next = new Set(selection);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Every row checked, or none. */
export function checkAll(rows: readonly TreeRow[], on: boolean): TreeSelection {
  return new Set(on ? shapeOf(rows).checkable : []);
}

/** The checked ids in order, for an import; main adds their headers. */
export function selectedIds(
  rows: readonly TreeRow[],
  selection: TreeSelection,
): readonly ServiceItemId[] {
  return rows.filter(row => selection.has(row.id)).map(row => row.id);
}

/** How many items the tree has, headers not counted. */
export function itemCount(rows: readonly TreeRow[]): number {
  return rows.filter(row => !row.header).length;
}
