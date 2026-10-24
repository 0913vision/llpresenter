const DEFAULT_DELAY_MS = 500;

/** Saves one file. It reports its own errors and resolves either way. */
export type Save = () => Promise<void>;

interface Waiting {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly save: Save;
}

/**
 * Saves a file once its changes stop for a moment, so typing writes once,
 * within 0.5 seconds after the last change. `flush` saves everything that
 * waits at once, for example before the app quits.
 */
export class Autosave {
  private readonly waiting = new Map<string, Waiting>();
  private readonly running = new Set<Promise<void>>();

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

  /**
   * Saves every file that waits now, and resolves when those saves and the
   * ones already running have finished.
   */
  async flush(): Promise<void> {
    for (const [key, {save}] of [...this.waiting]) {
      this.cancel(key);
      this.start(key, save);
    }
    await Promise.all(this.running);
  }

  /** Drops every waiting save without saving; call `flush` first to keep them. */
  dispose(): void {
    for (const key of [...this.waiting.keys()]) {
      this.cancel(key);
    }
  }

  private cancel(key: string): void {
    const waiting = this.waiting.get(key);
    if (waiting !== undefined) {
      clearTimeout(waiting.timer);
      this.waiting.delete(key);
    }
  }

  private start(key: string, save: Save): void {
    const run = this.run(key, save).finally(() => {
      this.running.delete(run);
    });
    this.running.add(run);
  }

  private async run(key: string, save: Save): Promise<void> {
    try {
      await save();
    } catch (error: unknown) {
      this.onError(key, error);
    }
  }
}
