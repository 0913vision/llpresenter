/**
 * How long a visible output may go without a frame rate report before its
 * renderer counts as hung. Reports come once a second (proposal).
 */
export const HANG_TIMEOUT_MS = 5000;

/**
 * Calls back when a renderer stops giving signs of life: each beat starts the
 * countdown over, and a countdown that runs out means the page stopped
 * drawing. Output windows get no input, so Electron's own `unresponsive`
 * event may never fire for them.
 */
export class HangWatch {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onHang: () => void,
    private readonly timeoutMs = HANG_TIMEOUT_MS,
  ) {}

  /** A sign of life: the countdown starts over. */
  beat(): void {
    this.stop();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onHang();
    }, this.timeoutMs);
  }

  stop(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
