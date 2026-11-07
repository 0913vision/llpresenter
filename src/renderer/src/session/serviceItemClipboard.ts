import type {LlpApi} from '@contracts/ipc/api';
import type {Result} from '@core/common/result';
import {createServiceItemId, type ServiceId} from '@core/schema/ids';
import {SERVICE_LIMITS, type ServiceItem} from '@core/schema/service';

const CLIPBOARD_BYTES = 16 * 1024 * 1024;
type ClipboardApi = Pick<LlpApi, 'services' | 'log'>;
type CopyResult = Result<true, 'missing' | 'empty' | 'full' | 'failed'>;
const clipboards = new WeakMap<ClipboardApi, ServiceItemClipboard>();

/** One bounded item clipboard shared by the window's services and workspaces. */
export function serviceItemClipboardFor(
  api: ClipboardApi,
): ServiceItemClipboard {
  let clipboard = clipboards.get(api);
  if (clipboard === undefined) {
    clipboard = new ServiceItemClipboard(api);
    clipboards.set(api, clipboard);
  }
  return clipboard;
}

/** Keeps complete item snapshots, including fields added by newer item models. */
export class ServiceItemClipboard {
  private items: readonly ServiceItem[] = [];
  private request = 0;
  private copying: Promise<CopyResult> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly api: ClipboardApi) {}

  readonly getCount = (): number => this.items.length;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  copy(
    serviceId: ServiceId,
    selected: ReadonlySet<string>,
  ): Promise<CopyResult> {
    const request = ++this.request;
    const ids = new Set(selected);
    const task = this.read(serviceId, ids, request);
    this.copying = task;
    return task.finally(() => {
      if (this.copying === task) this.copying = null;
    });
  }

  /** A paste issued immediately after copy waits for that snapshot to arrive. */
  async ready(): Promise<void> {
    while (this.copying !== null) await this.copying;
  }

  private async read(
    serviceId: ServiceId,
    ids: ReadonlySet<string>,
    request: number,
  ): Promise<CopyResult> {
    try {
      const document = await this.api.services.get(serviceId);
      if (request !== this.request) return {ok: true, value: true};
      if (document?.service.id !== serviceId) {
        return {ok: false, error: 'missing'};
      }
      const items = document.service.order.filter(item => ids.has(item.id));
      if (items.length === 0) return {ok: false, error: 'empty'};
      if (items.length !== ids.size) return {ok: false, error: 'missing'};
      if (
        items.length > SERVICE_LIMITS.items ||
        new TextEncoder().encode(JSON.stringify(items)).length > CLIPBOARD_BYTES
      ) {
        return {ok: false, error: 'full'};
      }
      this.items = structuredClone(items);
      for (const listener of this.listeners) listener();
      return {ok: true, value: true};
    } catch (error) {
      this.api.log.write({
        level: 'error',
        message: 'Could not copy service items',
        detail: error instanceof Error ? error.message : String(error),
      });
      return {ok: false, error: 'failed'};
    }
  }

  /** Fresh item ids keep nested slide ids and their internal references intact. */
  createItems(): readonly ServiceItem[] {
    return structuredClone(this.items).map(item => ({
      ...item,
      id: createServiceItemId(crypto.randomUUID()),
    }));
  }
}
