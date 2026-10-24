/** Crashes within {@link CRASH_PERIOD_MS} after which restarts stop (docs/spec/08-problems.md, proposal). */
export const CRASH_LIMIT = 3;

export const CRASH_PERIOD_MS = 60_000;

/** Counts one output window's recent crashes and decides whether it restarts again. */
export class RestartBudget {
  private crashTimes: readonly number[] = [];

  /**
   * Records a crash now.
   *
   * @returns Whether the window may restart.
   */
  recordCrash(): boolean {
    const now = Date.now();
    this.crashTimes = [
      ...this.crashTimes.filter(time => now - time < CRASH_PERIOD_MS),
      now,
    ];
    return this.crashTimes.length < CRASH_LIMIT;
  }

  /** Forgets earlier crashes, for when the operator retries. */
  reset(): void {
    this.crashTimes = [];
  }
}
