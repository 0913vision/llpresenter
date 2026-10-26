import type {CheckState} from '@renderer/ui/Checkbox';
import type {ServiceItemId} from '@shared/schema/ids';
import {
  isItemOfKind,
  serviceItemKind,
  type ServiceItem,
} from '@shared/schema/service';

/** One row of the 예배 순서 tree in the service dialogs. */
export interface TreeRow {
  readonly id: ServiceItemId;
  readonly header: boolean;
  readonly label: string;
  /** The item's 16px kind icon, as the 예배 순서 list draws it. */
  readonly icon?: string | undefined;
  /** The chosen 구성 of a song, such as 주일용, or 빈 자리 for a slot. */
  readonly detail?: string | undefined;
  /** The header the row sits under, if any. */
  readonly headerId?: ServiceItemId | undefined;
}

/** The checked rows by id: items, and headers with no items under them. */
export type TreeSelection = ReadonlySet<ServiceItemId>;

const DEFAULT_ARRANGEMENT = '기본';
const SLOT_DETAIL = '빈 자리';
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
  slot: 'listplus',
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
  if (isItemOfKind(item, 'slot')) {
    return {label: item.title, icon: icons.slot, detail: SLOT_DETAIL};
  }
  if (isItemOfKind(item, 'bible')) {
    return {label: item.bible.ref, icon: icons.bible};
  }
  const kind = serviceItemKind(item);
  return kind === 'media' || kind === 'notice'
    ? {label: kindLabels[kind], icon: icons[kind]}
    : {label: kindLabels.unknown, icon: icons.unknown};
}

/** The rows of a 예배 순서 or 틀, each item under the header before it. */
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

function childrenOf(
  rows: readonly TreeRow[],
  headerId: ServiceItemId,
): readonly TreeRow[] {
  return rows.filter(row => row.headerId === headerId);
}

// NOTE(0913vision): A full selection holds every item and every empty header.
function checkableIds(rows: readonly TreeRow[]): readonly ServiceItemId[] {
  return rows
    .filter(row => !row.header || childrenOf(rows, row.id).length === 0)
    .map(row => row.id);
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
    : stateOf(
        children.map(child => child.id),
        selection,
      );
}

/** The check-all box's state. */
export function allState(
  rows: readonly TreeRow[],
  selection: TreeSelection,
): CheckState {
  return stateOf(checkableIds(rows), selection);
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
  const ids =
    children.length === 0 ? [row.id] : children.map(child => child.id);
  const next = new Set(selection);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Every row checked, or none. */
export function checkAll(rows: readonly TreeRow[], on: boolean): TreeSelection {
  return new Set(on ? checkableIds(rows) : []);
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
