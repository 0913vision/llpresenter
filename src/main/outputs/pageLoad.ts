/**
 * How long a reloaded page may take to draw the live state before the load
 * counts as failed. A reload draws in about a second (docs/spec/08-problems.md);
 * this leaves room for a busy machine without a long blank screen.
 */
export const DRAW_LIMIT_MS = 10_000;

/** Why a page load failed: the load was rejected, or the page didn't draw in time. */
export type LoadFailure =
  | {readonly kind: 'rejected'; readonly error: unknown}
  | {readonly kind: 'not-drawn'};

/**
 * One reload of an output page, from the start of the load until its first
 * draw. It settles exactly once: it fails when the load is rejected or the
 * page misses its draw limit, or its owner settles it when the page draws or
 * dies. Nothing it hears after that changes anything.
 */
export class PageLoad {
  private drawTimer: ReturnType<typeof setTimeout> | null = null;
  private settled = false;

  constructor(
    loading: Promise<void>,
    private readonly onFailed: (failure: LoadFailure) => void,
  ) {
    loading.catch((error: unknown) => this.fail({kind: 'rejected', error}));
  }

  /** Gives the page {@link DRAW_LIMIT_MS} from now to draw. */
  startDrawLimit(): void {
    if (this.settled) return;
    this.stopDrawLimit();
    this.drawTimer = setTimeout(() => {
      this.drawTimer = null;
      this.fail({kind: 'not-drawn'});
    }, DRAW_LIMIT_MS);
  }

  /** Stops the draw limit, for example while the output is off. */
  stopDrawLimit(): void {
    if (this.drawTimer === null) return;
    clearTimeout(this.drawTimer);
    this.drawTimer = null;
  }

  /** Ends the load without a failure: the page drew, died, or was replaced. */
  settle(): void {
    this.settled = true;
    this.stopDrawLimit();
  }

  private fail(failure: LoadFailure): void {
    if (this.settled) return;
    this.settle();
    this.onFailed(failure);
  }
}
