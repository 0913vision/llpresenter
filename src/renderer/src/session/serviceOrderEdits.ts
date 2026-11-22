import type {LlpApi} from '@contracts/ipc/api';
import {copyName} from '@core/common/copyName';
import {limitReason} from '@core/common/limitReason';
import type {Result} from '@core/common/result';
import {moveSelection, orderedSelection} from '@core/common/selectionOrder';
import {
  createServiceItemId,
  type ServiceItemId,
  type SongId,
} from '@core/schema/ids';
import {
  SERVICE_LIMITS,
  type Service,
  type ServiceItem,
} from '@core/schema/service';
import {sectionInsertIndex} from '@core/services/quickAddPosition';
import {sectionBoundaryIndex} from '@core/services/serviceSections';
import {songItem} from '@core/slides/items';
import {
  editOpenService,
  type EditOptions,
  type OpenServiceResult,
  type OrderChange,
} from './openService';
import {selectAddedItem} from './selectAddedItem';
import {useShow} from './showStore';

type Order = Service['order'];
export type ServiceOrderEditResult = OpenServiceResult;

/** What a refused add says when the 예배 순서 has reached its item limit. */
export const ORDER_FULL_REASON = limitReason(
  '예배 순서 항목',
  SERVICE_LIMITS.items,
);

/**
 * The title of a notice for a refused 예배 순서 edit: the limit's sentence when
 * the edit would pass the item limit, else `fallback`.
 */
export function orderFailureTitle(
  error: {readonly reason: string; readonly message: string},
  fallback: string,
): string {
  return error.reason === 'full' ? error.message : fallback;
}

const isHeader = (item: ServiceItem): boolean => item.kind === 'header';

const newItemId = (): ServiceItemId => createServiceItemId(crypto.randomUUID());

function refuse(
  reason: 'invalid' | 'not-found',
  message: string,
): Result<never, {readonly reason: typeof reason; readonly message: string}> {
  return {ok: false, error: {reason, message}};
}

function insertionIndex(order: Order, beforeId: ServiceItemId | null): number {
  return beforeId === null
    ? order.length
    : order.findIndex(item => item.id === beforeId);
}

function hasAll(order: Order, ids: readonly ServiceItemId[]): boolean {
  return ids.every(id => order.some(item => item.id === id));
}

/** Refuses a change that would pass the item limit. */
function within(change: OrderChange): OrderChange {
  return service => {
    const result = change(service);
    return result.ok &&
      result.value.length > service.order.length &&
      result.value.length > SERVICE_LIMITS.items
      ? {ok: false, error: {reason: 'full', message: ORDER_FULL_REASON}}
      : result;
  };
}

/** Changes the order and selects the item that was added to it. */
async function add(
  change: OrderChange,
  added: () => string | undefined,
): Promise<OpenServiceResult> {
  const {serviceId, openItemId} = useShow.getState();
  const result = await editOpenService(within(change));
  const id = added();
  if (result.ok && result.value && serviceId !== null && id !== undefined) {
    selectAddedItem(serviceId, id, openItemId);
  }
  return result;
}

function edit(
  change: OrderChange,
  options?: EditOptions,
): Promise<OpenServiceResult> {
  return editOpenService(within(change), options);
}

export function removeItems(
  itemIds: readonly ServiceItemId[],
): Promise<OpenServiceResult> {
  return edit(({order}) => {
    if (!hasAll(order, itemIds)) {
      return refuse('not-found', 'An item no longer exists');
    }
    const ids = new Set(itemIds);
    return {ok: true, value: order.filter(item => !ids.has(item.id))};
  });
}

export function moveItems(
  itemIds: readonly ServiceItemId[],
  beforeId: ServiceItemId | null,
): Promise<OpenServiceResult> {
  return edit(({order}) => {
    if (!hasAll(order, itemIds)) {
      return refuse('not-found', 'An item no longer exists');
    }
    const moving = orderedSelection(order, new Set(itemIds), isHeader);
    const ids = new Set(moving.map(row => row.id));
    if (beforeId !== null && ids.has(beforeId)) {
      return {ok: true, value: order};
    }
    const requested = insertionIndex(order, beforeId);
    if (requested < 0) return refuse('not-found', 'The drop target is gone');
    const index = moving.some(isHeader)
      ? sectionBoundaryIndex(order, requested, isHeader)
      : requested;
    return {ok: true, value: moveSelection(order, ids, index)};
  });
}

/** Moves selected item rows one position, as one step. */
export function moveItemsStep(
  itemIds: readonly ServiceItemId[],
  direction: 'up' | 'down',
): Promise<OpenServiceResult> {
  return edit(service => {
    const selected = new Set(itemIds);
    if (
      itemIds.some(
        id => !service.order.some(item => item.id === id && !isHeader(item)),
      )
    ) {
      return refuse('not-found', 'An item no longer exists');
    }
    const order = [...service.order];
    const length = Math.max(0, order.length - 1);
    const indices =
      direction === 'up'
        ? Array.from({length}, (_, i) => i + 1)
        : Array.from({length}, (_, i) => order.length - 2 - i);
    for (const index of indices) {
      const other = index + (direction === 'up' ? -1 : 1);
      const item = order[index];
      const neighbor = order[other];
      if (
        item !== undefined &&
        neighbor !== undefined &&
        selected.has(item.id) &&
        !selected.has(neighbor.id)
      ) {
        order[index] = neighbor;
        order[other] = item;
      }
    }
    return {ok: true, value: order};
  });
}

/** Copies selected rows and complete sections once, in document order. */
export function duplicateItems(
  copyIds: ReadonlyMap<ServiceItemId, ServiceItemId>,
): Promise<OpenServiceResult> {
  return edit(({order}) => {
    if (!hasAll(order, [...copyIds.keys()])) {
      return refuse('not-found', 'An item no longer exists');
    }
    const selected = orderedSelection(order, new Set(copyIds.keys()), isHeader);
    const last = selected.at(-1);
    if (last === undefined) return {ok: true, value: order};
    const end = order.findIndex(row => row.id === last.id) + 1;
    const headers = order.flatMap(row => (isHeader(row) ? [row.name] : []));
    const copies = selected.map(row => {
      const id = copyIds.get(row.id) ?? newItemId();
      if (!isHeader(row)) return {...row, id};
      const name = copyName(row.name, headers);
      headers.push(name);
      return {...row, id, name};
    });
    return {
      ok: true,
      value: [...order.slice(0, end), ...copies, ...order.slice(end)],
    };
  });
}

/** Renames a header or an item; a blank name keeps the old one. */
export function renameItem(
  itemId: ServiceItemId,
  name: string,
): Promise<OpenServiceResult> {
  return edit(({order}) => {
    const item = order.find(row => row.id === itemId);
    if (item === undefined) {
      return refuse('not-found', 'The item no longer exists');
    }
    const next = name.trim();
    return {
      ok: true,
      value:
        next === '' || next === item.name
          ? order
          : order.map(row => (row.id === itemId ? {...item, name: next} : row)),
    };
  });
}

/** Inserts a new item before another, or at the end. */
export function insertItem(
  item: ServiceItem,
  beforeId: ServiceItemId | null,
): Promise<OpenServiceResult> {
  return add(
    ({order}) => {
      const index = insertionIndex(order, beforeId);
      if (index < 0) return refuse('not-found', 'The drop target is gone');
      return {
        ok: true,
        value: [...order.slice(0, index), item, ...order.slice(index)],
      };
    },
    () => item.id,
  );
}

/** Inserts a library song, with slides of its own. */
export async function insertSong(
  api: Pick<LlpApi, 'songs'>,
  songId: SongId,
  beforeId: ServiceItemId | null,
): Promise<OpenServiceResult> {
  const song = await api.songs.get(songId);
  return song?.song.id === songId
    ? insertItem(songItem(song.song), beforeId)
    : refuse('not-found', 'The song no longer exists');
}

/** Inserts the whole copied selection after a row, as one step. */
export function insertItems(
  items: readonly ServiceItem[],
  afterId: ServiceItemId | null,
): Promise<OpenServiceResult> {
  return edit(({order}) => {
    const selected =
      afterId === null
        ? order.length - 1
        : order.findIndex(item => item.id === afterId);
    if (afterId !== null && selected < 0) {
      return refuse('not-found', 'The paste target is gone');
    }
    return {
      ok: true,
      value: [
        ...order.slice(0, selected + 1),
        ...items,
        ...order.slice(selected + 1),
      ],
    };
  });
}

/** Inserts an item at the end of the section that holds the selected row. */
export function insertItemInSection(
  item: ServiceItem,
  selectedId: string | null,
  {select = true}: {readonly select?: boolean} = {},
): Promise<OpenServiceResult> {
  const change: OrderChange = ({order}) => {
    const index = sectionInsertIndex(order, selectedId, isHeader);
    return {
      ok: true,
      value: [...order.slice(0, index), item, ...order.slice(index)],
    };
  };
  return select ? add(change, () => item.id) : edit(change);
}
