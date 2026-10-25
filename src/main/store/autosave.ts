const DEFAULT_DELAY_MS = 500;

/** Saves one file. It reports its own errors and resolves either way. */
export type Save = () => Promise<void>;

interface Waiting {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly save: Save;
}

/**
 * Saves a file once its changes stop for a moment, so typing writes once,
 * within 0.5 seconds after the last change. One save runs per file at a time:
 * a save that comes due while the file's last one still runs waits for it, and
 * only the newest such save runs. `flush` saves everything that waits at once,
 * for example before the app quits.
 */
export class Autosave {
  private readonly waiting = new Map<string, Waiting>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly due = new Map<string, Save>();

  constructor(
    private readonly onError: (key: string, error: unknown) => void,
    private readonly delayMs: number = DEFAULT_DELAY_MS,
  ) {}

  /** Saves `key` after the delay, replacing a save that still waits for it. */
  schedule(key: string, save: Save): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.waiting.delete(key);
      this.start(key, save);
    }, this.delayMs);
    this.waiting.set(key, {timer, save});
  }

  /** Drops waiting and due callbacks for a file that the caller will save explicitly. */
  cancelPending(key: string): void {
    this.cancel(key);
    this.due.delete(key);
  }

  /** Waits only for saves already running for this file. */
  async idle(key: string): Promise<void> {
    while (this.running.has(key)) await this.running.get(key);
  }

  /**
   * Saves every file that waits now, and resolves when those saves, the ones
   * already running, and the ones that came due meanwhile have finished.
   */
  async flush(): Promise<void> {
    for (const [key, {save}] of [...this.waiting]) {
      this.cancel(key);
      this.start(key, save);
    }
    while (this.running.size > 0) {
      await Promise.all(this.running.values());
    }
  }

  /** Drops every waiting save without saving; call `flush` first to keep them. */
  dispose(): void {
    for (const key of [...this.waiting.keys()]) {
      this.cancel(key);
    }
    this.due.clear();
  }

  private cancel(key: string): void {
    const waiting = this.waiting.get(key);
    if (waiting !== undefined) {
      clearTimeout(waiting.timer);
      this.waiting.delete(key);
    }
  }

  private start(key: string, save: Save): void {
    if (this.running.has(key)) {
      this.due.set(key, save);
      return;
    }
    const run = this.run(key, save).finally(() => this.startDue(key));
    this.running.set(key, run);
  }

  private startDue(key: string): void {
    this.running.delete(key);
    const save = this.due.get(key);
    if (save !== undefined) {
      this.due.delete(key);
      this.start(key, save);
    }
  }

  private async run(key: string, save: Save): Promise<void> {
    try {
      await save();
    } catch (error: unknown) {
      this.onError(key, error);
    }
  }
}
