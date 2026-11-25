/** How often main checks whether the control renderer answers. */
export const CONTROL_HEARTBEAT_MS = 1000;
/** How long an unanswered heartbeat may remain outstanding. */
export const CONTROL_HEARTBEAT_TIMEOUT_MS = 5000;
/**
 * A check that comes this much later than the one before shows that main
 * itself did not run: the PC slept, or main was busy.
 */
const MAIN_STALL_MS = 2 * CONTROL_HEARTBEAT_MS;

/** A single outstanding ping bounds memory while a renderer is hung. */
export class ControlHeartbeat {
  private timer: ReturnType<typeof setInterval> | undefined;
  private pending: {
    readonly generation: number;
    readonly since: number;
    readonly inFlight: boolean;
  } | null = null;
  private generation = 0;
  private failed = false;
  private lastTick: number | null = null;

  constructor(
    private readonly ping: () => Promise<unknown>,
    private readonly onTimeout: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    if (this.timer !== undefined) return;
    this.failed = false;
    this.timer = setInterval(() => this.tick(), CONTROL_HEARTBEAT_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.pending = null;
    this.lastTick = null;
    this.generation++;
  }

  private tick(): void {
    if (this.failed) return;
    const time = this.now();
    const mainStalled =
      this.lastTick !== null && time - this.lastTick > MAIN_STALL_MS;
    this.lastTick = time;
    if (mainStalled && this.pending !== null) {
      // NOTE(0913vision): While main did not run, an answer could not be
      // heard, so the window gets its full time again from now; a sleep or a
      // busy main must not count as a hung window and restart the graphics.
      this.pending = {...this.pending, since: time};
    }
    if (this.pending !== null) {
      if (time - this.pending.since >= CONTROL_HEARTBEAT_TIMEOUT_MS) {
        this.failed = true;
        this.onTimeout();
        return;
      }
      if (this.pending.inFlight) return;
    }
    const since = this.pending?.since ?? time;
    const generation = ++this.generation;
    this.pending = {generation, since, inFlight: true};
    Promise.resolve()
      .then(this.ping)
      .then(
        () => this.settle(generation),
        () => {
          if (this.pending?.generation === generation && !this.failed) {
            this.pending = {...this.pending, inFlight: false};
          }
        },
      );
  }

  private settle(generation: number): void {
    if (this.pending?.generation !== generation || this.failed) return;
    this.pending = null;
  }
}
