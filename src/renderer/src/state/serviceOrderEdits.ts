import type {LlpApi} from '@shared/ipc';
import {isRecord} from '@shared/guards';
import type {Result} from '@shared/result';
import type {EditFailure} from '@shared/schema/contentEdit';
import {
  createServiceItemId,
  type ServiceId,
  type ServiceItemId,
  type SongId,
} from '@shared/schema/ids';
import type {Service} from '@shared/schema/service';

const HISTORY_LIMIT = 100;
type Order = Service['order'];
type EditApi = Pick<LlpApi, 'services' | 'songs' | 'content'>;
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

function refuse(reason: 'not-found' | 'read-only' | 'stale', message: string) {
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

/**
 * Edits main-owned service orders without access to output commands.
 * A later change to any item's own fields makes undo or redo refuse as stale.
 */
export class ServiceOrderEdits {
  private readonly past: HistoryEntry[] = [];
  private readonly future: HistoryEntry[] = [];
  private busy = false;

  constructor(private readonly api: EditApi) {}

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
      const item = service.order.find(row => row.id === itemId);
      if (item === undefined) {
        return refuse('not-found', 'The item no longer exists');
      }
      if (itemId === beforeId) return {ok: true, value: service.order};
      const order = service.order.filter(row => row.id !== itemId);
      const index = insertionIndex(order, beforeId);
      if (index < 0) return refuse('not-found', 'The drop target is gone');
      order.splice(index, 0, item);
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

  undo(serviceId: ServiceId): Promise<ServiceOrderEditResult> {
    return this.replay(serviceId, 'undo');
  }

  redo(serviceId: ServiceId): Promise<ServiceOrderEditResult> {
    return this.replay(serviceId, 'redo');
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
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
      action,
    );
  }

  private async update(
    serviceId: ServiceId,
    change: OrderChange,
    action: HistoryAction = 'record',
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
      const saved = await this.api.content.edit({
        type: 'service.update',
        service: {...document.service, order: after},
        baseRevision: document.revision,
      });
      if (saved.ok || saved.error.reason === 'write-failed') {
        this.record({serviceId, before, after}, action);
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

  private record(entry: HistoryEntry, action: HistoryAction): void {
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
}
