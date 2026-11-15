/** How often main checks whether the control renderer answers. */
export const CONTROL_HEARTBEAT_MS = 1000;
/** How long an unanswered heartbeat may remain outstanding. */
export const CONTROL_HEARTBEAT_TIMEOUT_MS = 5000;

/** A single outstanding ping bounds memory while a renderer is hung. */
export class ControlHeartbeat {
  private timer: ReturnType<typeof setInterval> | undefined;
  private pending: {
    readonly generation: number;
    readonly since: number;
  } | null = null;
  private generation = 0;
  private failed = false;

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
    this.generation++;
  }

  private tick(): void {
    if (this.failed) return;
    const time = this.now();
    if (this.pending !== null) {
      if (time - this.pending.since >= CONTROL_HEARTBEAT_TIMEOUT_MS) {
        this.failed = true;
        this.onTimeout();
      }
      return;
    }
    const generation = ++this.generation;
    this.pending = {generation, since: time};
    Promise.resolve()
      .then(this.ping)
      .then(
        () => this.settle(generation),
        () => undefined,
      );
  }

  private settle(generation: number): void {
    if (this.pending?.generation !== generation || this.failed) return;
    this.pending = null;
  }
}
