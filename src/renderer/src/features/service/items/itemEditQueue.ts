import type {ServiceItemChange} from '@core/services/itemFieldChanges';
import {
  pendingWritesOf,
  type PendingWrites,
} from '@renderer/platform/pendingWrites';
import {
  updateServiceItem,
  type ServiceItemApi,
} from '@renderer/session/serviceItemUpdate';
/** The service and item captured before a write waits in the queue. */
export interface ItemTarget {
  readonly serviceId: string;
  readonly itemId: string;
}
/** A fixed target and a transformation applied to the fresh service revision. */
export interface ItemEditRequest {
  readonly change: ServiceItemChange;
  readonly failure: string;
  readonly target: ItemTarget | null;
  readonly retry?: () => unknown;
}
/** Reports a read or write failure through the facade's current notice context. */
export type ItemProblem = (
  title: string,
  retry?: () => unknown,
  retryLabel?: string,
) => void;
const RETRY_SAVE_LABEL = '다시 저장';
/** Serializes item writes and registers their entire wait with the window close gate. */
export class ItemEditQueue {
  private queue: Promise<unknown> = Promise.resolve();
  private running = 0;
  private alive = true;
  private readonly listeners = new Set<() => void>();
  private readonly writes: PendingWrites;
  private readonly stopWrites: () => void;
  /** Uses the same window API object so admission shares its existing close gate. */
  constructor(
    private readonly api: ServiceItemApi,
    private readonly onProblem: ItemProblem,
  ) {
    this.writes = pendingWritesOf(api);
    this.stopWrites = this.writes.subscribe(() => this.publish());
  }
  /** Whether an edit is running or the window has stopped new writes. */
  get busy(): boolean {
    return this.running > 0 || this.writes.isStopped;
  }
  /** Follows edit activity and the shared close gate without creating another gate. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Queues one captured request through the pending-write registration path. */
  submit(request: ItemEditRequest): Promise<boolean> {
    return this.run(() => this.apply(request));
  }
  /** Registers an entire composed write before it waits behind earlier edits. */
  run(task: () => Promise<boolean>): Promise<boolean> {
    if (!this.alive) return Promise.resolve(false);
    return this.writes.run({
      write: () => this.enqueue(task),
      refused: false,
      sent: sent => sent,
    });
  }
  /** The close-flush path: queues work after admission has already stopped. */
  enqueue(task: () => Promise<boolean>): Promise<boolean> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  /** Returns the existing tail so a close flush waits for the same queued work. */
  waitIdle(): Promise<unknown> {
    return this.queue;
  }
  /** Applies a request already admitted by run or the close-flush path. */
  async apply({
    change,
    failure,
    target,
    retry,
  }: ItemEditRequest): Promise<boolean> {
    if (!this.alive || target === null) return false;
    this.setRunning(1);
    const result = await updateServiceItem(this.api, {...target, change});
    this.setRunning(-1);
    if (result.ok) return true;
    if (result.error.reason === 'write-failed') {
      this.problem('예배 순서 저장 실패');
      return true;
    }
    this.problem(failure, retry, RETRY_SAVE_LABEL);
    return false;
  }
  private setRunning(change: 1 | -1): void {
    this.running += change;
    this.publish();
  }
  private problem(...args: Parameters<ItemProblem>): void {
    if (this.alive) this.onProblem(...args);
  }
  private publish(): void {
    for (const listener of this.listeners) listener();
  }
  /** Refuses future operations without abandoning already registered work. */
  dispose(): void {
    this.alive = false;
    this.stopWrites();
    this.listeners.clear();
  }
}
