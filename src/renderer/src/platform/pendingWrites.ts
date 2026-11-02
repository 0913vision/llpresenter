/** How a gated write runs, and what it answers once writing has stopped. */
export interface GatedWrite<T> {
  readonly write: () => Promise<T>;
  /** The answer while writing is stopped for a close. */
  readonly refused: T;
  /** Whether a result means the change reached the main process. */
  readonly sent: (result: T) => boolean;
}

/** How the operator settled a draft: decided, backed out of the close, or it failed. */
export type DraftOutcome = 'settled' | 'canceled' | 'failed';

/**
 * The control window's edits that read before they send, such as 예배 순서
 * and item edits: until they send, their change exists only here. The close
 * flush stops new ones, waits for the running ones, and refuses the close
 * when one of them didn't reach the main process.
 */
export class PendingWrites {
  private stopped = false;
  private readonly running = new Set<Promise<boolean>>();
  private readonly drafts = new Set<{
    readonly settle: () => Promise<DraftOutcome>;
    readonly onError: (error: unknown) => void;
  }>();
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
   * Registers edits that exist only in the window until the operator decides,
   * such as a 테마 draft. `settle` asks what to do with them and answers the
   * outcome; `onError` receives what a failing `settle` threw.
   */
  addDraft(
    settle: () => Promise<DraftOutcome>,
    onError: (error: unknown) => void,
  ): () => void {
    const draft = {settle, onError};
    this.drafts.add(draft);
    return () => {
      this.drafts.delete(draft);
    };
  }

  get hasDrafts(): boolean {
    return this.drafts.size > 0;
  }

  /**
   * Close preflight, before writing stops: lets each draft ask its question
   * in turn. A cancel ends it at once; a failing draft counts as failed and its
   * error goes to its `onError`.
   */
  async settleDrafts(): Promise<DraftOutcome> {
    let outcome: DraftOutcome = 'settled';
    for (const {settle, onError} of [...this.drafts]) {
      try {
        const answer = await settle();
        if (answer === 'canceled') return answer;
        if (answer === 'failed') outcome = answer;
      } catch (error) {
        onError(error);
        outcome = 'failed';
      }
    }
    return outcome;
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
