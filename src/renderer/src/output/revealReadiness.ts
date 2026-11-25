/**
 * How long an output waits before it tells main again that a frame is not
 * ready.
 */
export const READY_RECHECK_MS = 100;

/** How often an output that waits to be revealed checks its frame. */
export const READY_POLL_MS = 16;

/** What the reveal of one output reads and tells. */
export interface RevealOptions {
  /** Whether the latest drawing is complete: fonts, a frame, every element. */
  readonly complete: () => boolean;
  /** Names the drawing on screen; a new drawing or window size gets a new one. */
  readonly frameKey: () => string;
  /** The live version drawn, or null before the first live state. */
  readonly version: () => number | null;
  /** Whether the screen is turned on. */
  readonly enabled: () => boolean;
  /**
   * Tells main whether the frame is ready.
   *
   * @returns Whether main shows the window now.
   */
  readonly report: (frame: {
    readonly version: number;
    readonly ready: boolean;
  }) => Promise<boolean>;
  /** A turned-off screen has its picture ready for the next turn-on. */
  readonly onStandbyReady: () => void;
  /** Main shows the turned-on screen now. */
  readonly onShown: () => void;
  readonly onError: (message: string, error: unknown) => void;
}

/**
 * Tells main when a screen has painted a complete frame, so main shows its
 * window only then (docs/spec/03-output.md). A frame counts as painted when two
 * animation frames in a row see the same complete drawing. While a reveal is
 * pending it asks every {@link READY_POLL_MS}, repeating a "not ready" at most
 * every {@link READY_RECHECK_MS}, one question at a time, until main answers;
 * turning the screen on again or resizing starts it over, and an answer to an
 * older start is ignored.
 */
export class RevealReadiness {
  private pending = true;
  /** Counts the starts, so an answer to an older one is ignored. */
  private start = 0;
  private lastAttempt = -Infinity;
  private lastReady = false;
  private seenFrame = '';
  private paintedFrame = '';
  private asking = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly options: RevealOptions) {}

  /** Whether the screen still waits to be revealed. */
  get isPending(): boolean {
    return this.pending;
  }

  /** The screen waits again to be revealed, as when it was just turned on. */
  restart(): void {
    this.start += 1;
    this.pending = true;
    this.lastAttempt = -Infinity;
    this.lastReady = false;
  }

  /** Forgets the frames seen so far, so readiness waits for a new paint. */
  forgetFrames(): void {
    this.seenFrame = '';
    this.paintedFrame = '';
  }

  /** An animation frame came: notes whether the drawing stayed the same. */
  noteFrame(time: number): void {
    if (!this.pending) return;
    const key = this.options.complete() ? this.options.frameKey() : '';
    if (key === '') this.paintedFrame = '';
    else if (key === this.seenFrame) this.paintedFrame = key;
    this.seenFrame = key;
    this.ask(time);
  }

  /** Keeps asking while a reveal is pending, even without animation frames. */
  watch(): void {
    if (this.stopped || this.timer !== null || !this.pending) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.ask(performance.now());
      this.watch();
    }, READY_POLL_MS);
  }

  stop(): void {
    this.stopped = true;
    this.clearTimer();
  }

  private ask(time: number): void {
    const version = this.options.version();
    if (this.stopped || this.asking || version === null || !this.pending) {
      return;
    }
    // NOTE(0913vision): An unpainted frame must reach main as not ready so it
    // can wake a hidden native compositor without treating a timer as a paint.
    const ready =
      this.options.complete() && this.paintedFrame === this.options.frameKey();
    if (
      time - this.lastAttempt < READY_RECHECK_MS &&
      (!ready || this.lastReady)
    ) {
      return;
    }
    this.lastAttempt = time;
    this.lastReady = ready;
    const start = this.start;
    this.asking = true;
    void this.options
      .report({version, ready})
      .then(shown => {
        if (this.stopped || this.start !== start) return;
        if (!this.options.enabled() && ready) {
          this.pending = false;
          this.clearTimer();
          this.options.onStandbyReady();
        } else if (this.options.enabled() && shown) {
          this.pending = false;
          this.options.onShown();
        }
      })
      .catch((error: unknown) =>
        this.options.onError('could not report a ready output frame', error),
      )
      .finally(() => {
        this.asking = false;
      });
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
