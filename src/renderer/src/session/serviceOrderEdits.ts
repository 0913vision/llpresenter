import type {LlpApi} from '@contracts/ipc/api';
import {copyName} from '@core/common/copyName';
import {isRecord} from '@core/common/guards';
import {limitReason} from '@core/common/limitReason';
import type {Result} from '@core/common/result';
import type {EditFailure} from '@core/schema/contentEdit';
import {
  createServiceItemId,
  type ServiceId,
  type ServiceItemId,
  type SongId,
} from '@core/schema/ids';
import {
  isItemOfKind,
  SERVICE_LIMITS,
  type Service,
  type ServiceItem,
} from '@core/schema/service';
import {sectionBoundaryIndex} from '@core/services/serviceSections';
import {pendingWritesOf} from '../platform/pendingWrites';

const HISTORY_LIMIT = 100;
type Order = Service['order'];
type EditApi = Pick<LlpApi, 'services' | 'songs' | 'content'>;
const editors = new WeakMap<EditApi, ServiceOrderEdits>();
const histories = new WeakMap<object, OrderHistory>();

// NOTE(0913vision): The history belongs to the API object itself, so every
// caller must pass the window's own `window.llp`, never a copy of it.
function historyFor(api: object): OrderHistory {
  let history = histories.get(api);
  if (history === undefined) {
    history = new OrderHistory();
    histories.set(api, history);
  }
  return history;
}

/**
 * Records a saved edit of one item's own fields (메모, 테마, 구성, 배경, 시작할
 * 때, 오버레이) as one step of the 예배 순서 history, whichever path saved it.
 */
export function recordItemEdit(
  api: object,
  entry: {
    readonly serviceId: ServiceId;
    readonly before: Order;
    readonly after: Order;
  },
): void {
  historyFor(api).record(entry, 'record');
}

/** Shares the service list's undo history with every service order entry point. */
export function serviceOrderEditsFor(api: EditApi): ServiceOrderEdits {
  let editor = editors.get(api);
  if (editor === undefined) {
    editor = new ServiceOrderEdits(api);
    editors.set(api, editor);
  }
  return editor;
}
interface LocalFailure {
  readonly reason: 'busy' | 'request-failed';
  readonly message: string;
}
export type ServiceOrderEditResult = Result<
  boolean,
  EditFailure | LocalFailure
>;
type OrderChange = (
  service: Service,
) => Result<Order, EditFailure> | Promise<Result<Order, EditFailure>>;
type HistoryAction = 'record' | 'undo' | 'redo';
interface HistoryEntry {
  readonly serviceId: ServiceId;
  readonly before: Order;
  readonly after: Order;
}

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
  error: {readonly message: string},
  fallback: string,
): string {
  return error.message === ORDER_FULL_REASON ? ORDER_FULL_REASON : fallback;
}

function refuse(
  reason: 'invalid' | 'not-found' | 'read-only' | 'stale',
  message: string,
) {
  return {ok: false, error: {reason, message}} as const;
}

function sameOrder(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    const rightValues: readonly unknown[] = right;
    return (
      left.length === right.length &&
      left.every((value: unknown, index) =>
        sameOrder(value, rightValues[index]),
      )
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      key => Object.hasOwn(right, key) && sameOrder(left[key], right[key]),
    )
  );
}

function insertionIndex(order: Order, beforeId: ServiceItemId | null): number {
  return beforeId === null
    ? order.length
    : order.findIndex(item => item.id === beforeId);
}

/** The undo and redo steps of the 예배 순서, at most HISTORY_LIMIT deep. */
class OrderHistory {
  readonly past: HistoryEntry[] = [];
  readonly future: HistoryEntry[] = [];

  record(entry: HistoryEntry, action: HistoryAction): void {
    if (action === 'undo') {
      const previous = this.past.pop();
      if (previous !== undefined) this.future.push(previous);
      return;
    }
    if (action === 'redo') {
      const next = this.future.pop();
      if (next !== undefined) this.past.push(next);
      return;
    }
    this.future.length = 0;
    this.past.push(entry);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
  }
}

/**
 * Edits main-owned service orders without access to output commands.
 * An edit of an item's own fields is recorded here too (`recordItemEdit`); a
 * change nobody recorded makes undo or redo refuse as stale.
 */
export class ServiceOrderEdits {
  private readonly history: OrderHistory;
  private busy = false;

  constructor(private readonly api: EditApi) {
    this.history = historyFor(api);
  }

  private get past(): HistoryEntry[] {
    return this.history.past;
  }

  private get future(): HistoryEntry[] {
    return this.history.future;
  }

  canUndo(serviceId: ServiceId): boolean {
    return this.past.at(-1)?.serviceId === serviceId;
  }

  canRedo(serviceId: ServiceId): boolean {
    return this.future.at(-1)?.serviceId === serviceId;
  }

  remove(serviceId: ServiceId, itemId: ServiceItemId) {
    return this.update(serviceId, service => {
      if (!service.order.some(item => item.id === itemId)) {
        return refuse('not-found', 'The item no longer exists');
      }
      return {
        ok: true,
        value: service.order.filter(item => item.id !== itemId),
      };
    });
  }

  move(
    serviceId: ServiceId,
    itemId: ServiceItemId,
    beforeId: ServiceItemId | null,
  ) {
    return this.update(serviceId, service => {
      const start = service.order.findIndex(row => row.id === itemId);
      const item = service.order[start];
      if (item === undefined) {
        return refuse('not-found', 'The item no longer exists');
      }
      const nextHeader = isItemOfKind(item, 'header')
        ? service.order.findIndex(
            (row, index) => index > start && isItemOfKind(row, 'header'),
          )
        : start + 1;
      const end = nextHeader < 0 ? service.order.length : nextHeader;
      const moving = service.order.slice(start, end);
      if (moving.some(row => row.id === beforeId)) {
        return {ok: true, value: service.order};
      }
      const order = [
        ...service.order.slice(0, start),
        ...service.order.slice(end),
      ];
      const requested = insertionIndex(order, beforeId);
      const index = isItemOfKind(item, 'header')
        ? sectionBoundaryIndex(order, requested, row =>
            isItemOfKind(row, 'header'),
          )
        : requested;
      if (index < 0) return refuse('not-found', 'The drop target is gone');
      order.splice(index, 0, ...moving);
      return {ok: true, value: order};
    });
  }

  insertSong(
    serviceId: ServiceId,
    songId: SongId,
    beforeId: ServiceItemId | null,
  ) {
    return this.update(serviceId, async service => {
      const index = insertionIndex(service.order, beforeId);
      if (index < 0) return refuse('not-found', 'The drop target is gone');
      const song = await this.api.songs.get(songId);
      if (song?.song.id !== songId) {
        return refuse('not-found', 'The song no longer exists');
      }
      const order = [...service.order];
      order.splice(index, 0, {
        id: createServiceItemId(crypto.randomUUID()),
        song: songId,
      });
      return {ok: true, value: order};
    });
  }

  /**
   * Copies an item right after itself with a new id, as one undo step. A 구역
   * copies the whole section (the header and its items up to the next header)
   * and the copy goes after the section. The copy of the clicked row takes
   * `copyId`; the other rows of a section get fresh ids.
   */
  duplicate(
    serviceId: ServiceId,
    itemId: ServiceItemId,
    copyId: ServiceItemId,
  ) {
    return this.update(serviceId, service => {
      const start = service.order.findIndex(row => row.id === itemId);
      const item = service.order[start];
      if (item === undefined) {
        return refuse('not-found', 'The item no longer exists');
      }
      const header = isItemOfKind(item, 'header');
      const next = header
        ? service.order.findIndex(
            (row, index) => index > start && isItemOfKind(row, 'header'),
          )
        : -1;
      const end = header ? (next < 0 ? service.order.length : next) : start + 1;
      const headers = service.order.flatMap(row =>
        isItemOfKind(row, 'header') ? [row.header] : [],
      );
      const copies = service.order.slice(start, end).map((row, index) => {
        const id =
          index === 0 ? copyId : createServiceItemId(crypto.randomUUID());
        return isItemOfKind(row, 'header')
          ? {...row, id, header: copyName(row.header, headers)}
          : {...row, id};
      });
      return {
        ok: true,
        value: [
          ...service.order.slice(0, end),
          ...copies,
          ...service.order.slice(end),
        ],
      };
    });
  }

  /** Renames a header; a blank name keeps the old one. */
  renameHeader(serviceId: ServiceId, itemId: ServiceItemId, name: string) {
    return this.update(serviceId, service => {
      const item = service.order.find(row => row.id === itemId);
      if (item === undefined || !isItemOfKind(item, 'header')) {
        return refuse('not-found', 'The header no longer exists');
      }
      const header = name.trim();
      if (header === '' || header === item.header) {
        return {ok: true, value: service.order};
      }
      return {
        ok: true,
        value: service.order.map(row =>
          row.id === itemId ? {...item, header} : row,
        ),
      };
    });
  }

  /** Inserts a new item that doesn't read other files, such as a header. */
  insertItem(
    serviceId: ServiceId,
    item: ServiceItem,
    beforeId: ServiceItemId | null,
  ) {
    return this.update(serviceId, service => {
      const index = insertionIndex(service.order, beforeId);
      if (index < 0) return refuse('not-found', 'The drop target is gone');
      const order = [...service.order];
      order.splice(index, 0, item);
      return {ok: true, value: order};
    });
  }

  /** Prepares an item under the close gate and inserts it in the current section. */
  insertItemInSection(
    serviceId: ServiceId,
    selectedId: string | null,
    prepare: () => Promise<ServiceItem>,
  ) {
    let item: ServiceItem | undefined;
    return this.update(
      serviceId,
      service => {
        if (!item) return refuse('invalid', 'The item is unavailable');
        const selected = service.order.findIndex(row => row.id === selectedId);
        const next =
          selected < 0
            ? -1
            : service.order.findIndex(
                (row, index) => index > selected && isItemOfKind(row, 'header'),
              );
        const order = [...service.order];
        order.splice(next < 0 ? order.length : next, 0, item);
        return {ok: true, value: order};
      },
      {
        beforeRead: async () => {
          item = await prepare();
        },
      },
    );
  }

  undo(serviceId: ServiceId): Promise<ServiceOrderEditResult> {
    return this.replay(serviceId, 'undo');
  }

  redo(serviceId: ServiceId): Promise<ServiceOrderEditResult> {
    return this.replay(serviceId, 'redo');
  }

  clear(): void {
    this.history.clear();
  }

  private replay(serviceId: ServiceId, action: 'undo' | 'redo') {
    const entry = (action === 'undo' ? this.past : this.future).at(-1);
    if (entry?.serviceId !== serviceId) {
      return Promise.resolve<ServiceOrderEditResult>({ok: true, value: false});
    }
    return this.update(
      serviceId,
      service => {
        const expected = action === 'undo' ? entry.after : entry.before;
        if (!sameOrder(service.order, expected)) {
          return refuse('stale', 'The service order changed after this edit');
        }
        return {
          ok: true,
          value: action === 'undo' ? entry.before : entry.after,
        };
      },
      {action},
    );
  }

  // NOTE(0913vision): The window's pending writes let the close flush wait
  // for an edit between its read and its write, and refuse new ones.
  private update(
    serviceId: ServiceId,
    change: OrderChange,
    options: {action?: HistoryAction; beforeRead?: () => Promise<void>} = {},
  ): Promise<ServiceOrderEditResult> {
    const {action = 'record', beforeRead} = options;
    return pendingWritesOf(this.api).run({
      write:
        beforeRead === undefined
          ? () => this.send(serviceId, change, action)
          : async () => {
              await beforeRead();
              return this.send(serviceId, change, action);
            },
      refused: {
        ok: false,
        error: {reason: 'busy', message: 'Edits stopped for closing'},
      },
      sent: result => result.ok || result.error.reason === 'write-failed',
    });
  }

  private async send(
    serviceId: ServiceId,
    change: OrderChange,
    action: HistoryAction,
  ): Promise<ServiceOrderEditResult> {
    if (this.busy) {
      return {
        ok: false,
        error: {reason: 'busy', message: 'An edit is pending'},
      };
    }
    this.busy = true;
    try {
      const document = await this.api.services.get(serviceId);
      if (document?.service.id !== serviceId) {
        return refuse('not-found', 'The service no longer exists');
      }
      if (document.access === 'readOnly') {
        return refuse('read-only', 'The service is read-only');
      }
      const result = await change(document.service);
      if (!result.ok) return result;
      const before = document.service.order;
      const after = result.value;
      if (sameOrder(before, after)) return {ok: true, value: false};
      if (after.length > before.length && after.length > SERVICE_LIMITS.items) {
        return refuse('invalid', ORDER_FULL_REASON);
      }
      const saved = await this.api.content.edit({
        type: 'service.update',
        service: {...document.service, order: after},
        baseRevision: document.revision,
      });
      if (saved.ok || saved.error.reason === 'write-failed') {
        this.history.record({serviceId, before, after}, action);
      }
      return saved.ok ? {ok: true, value: true} : saved;
    } catch (cause) {
      return {
        ok: false,
        error: {
          reason: 'request-failed',
          message: cause instanceof Error ? cause.message : String(cause),
        },
      };
    } finally {
      this.busy = false;
    }
  }
}
