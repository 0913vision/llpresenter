/**
 * Runs work one after another in the order it was given: each starts once the
 * one before it has settled, whether it succeeded or failed, so nothing given
 * is dropped and nothing overtakes what came before it.
 */
export class InTurn {
  private last: Promise<void> = Promise.resolve();

  /**
   * Runs `work` after everything given before it.
   *
   * @returns What `work` returns, or its failure.
   */
  run<T>(work: () => T | Promise<T>): Promise<T> {
    const turn = this.last.then(work);
    this.last = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }

  /** Resolves once everything given so far has settled. */
  idle(): Promise<void> {
    return this.last;
  }
}

/**
 * One line of work per key: work for the same key runs in turn, work for
 * different keys does not wait. A key's line is dropped once it is empty.
 */
export class InTurnByKey<K> {
  private readonly lines = new Map<K, Promise<void>>();

  /**
   * Runs `work` after everything given before it for `key`.
   *
   * @returns What `work` returns, or its failure.
   */
  run<T>(key: K, work: () => T | Promise<T>): Promise<T> {
    const turn = (this.lines.get(key) ?? Promise.resolve()).then(work);
    const settled = turn.then(
      () => undefined,
      () => undefined,
    );
    this.lines.set(key, settled);
    const drop = (): void => {
      if (this.lines.get(key) === settled) this.lines.delete(key);
    };
    settled.then(drop, drop);
    return turn;
  }

  /** Resolves once everything given so far for `key` has settled. */
  idle(key: K): Promise<void> {
    return this.lines.get(key) ?? Promise.resolve();
  }

  /** How many keys have work given that has not settled. */
  get size(): number {
    return this.lines.size;
  }
}
