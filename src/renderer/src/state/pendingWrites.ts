/** How a gated write runs, and what it answers once writing has stopped. */
export interface GatedWrite<T> {
  readonly write: () => Promise<T>;
  /** The answer while writing is stopped for a close. */
  readonly refused: T;
  /** Whether a result means the change reached the main process. */
  readonly sent: (result: T) => boolean;
}

/**
 * The control window's edits that read before they send, such as 예배 순서
 * and item edits: until they send, their change exists only here. The close
 * flush stops new ones, waits for the running ones, and refuses the close
 * when one of them didn't reach the main process.
 */
export class PendingWrites {
  private stopped = false;
  private readonly running = new Set<Promise<boolean>>();
  private readonly listeners = new Set<() => void>();

  get isStopped(): boolean {
    return this.stopped;
  }

  run<T>({write, refused, sent}: GatedWrite<T>): Promise<T> {
    if (this.stopped) return Promise.resolve(refused);
    const result = write();
    const reached = result.then(sent, () => false);
    this.running.add(reached);
    const settled = (): void => {
      this.running.delete(reached);
    };
    reached.then(settled, settled);
    return result;
  }

  /**
   * Close preflight: stops new writes and answers, once the running ones have
   * ended, whether each reached the main process.
   */
  async flush(): Promise<boolean> {
    this.setStopped(true);
    const outcomes = await Promise.all(this.running);
    return outcomes.every(Boolean);
  }

  /** Restarts writing after a refused close. */
  resume(): void {
    this.setStopped(false);
  }

  /** Calls the listener when writing stops or restarts. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStopped(stopped: boolean): void {
    if (this.stopped === stopped) return;
    this.stopped = stopped;
    for (const listener of this.listeners) listener();
  }
}

const gates = new WeakMap<object, PendingWrites>();

/**
 * The pending writes of one window API, so every writer of the window and its
 * close flush share them without holding an old API alive.
 */
export function pendingWritesOf(api: object): PendingWrites {
  let gate = gates.get(api);
  if (gate === undefined) {
    gate = new PendingWrites();
    gates.set(api, gate);
  }
  return gate;
}
