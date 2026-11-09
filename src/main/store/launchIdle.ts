const IDLE_DELAY_MS = 1000;
const BUSY_DELAY_MS = 100;

/** Releases launch upkeep only after both readiness signals and a quiet main turn. */
export class LaunchIdle {
  private service = false;
  private outputs = false;
  private settled = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private finish: (ready: boolean) => void = () => undefined;
  readonly ready = new Promise<boolean>(resolve => {
    this.finish = resolve;
  });

  serviceReady(): void {
    this.service = true;
    this.schedule();
  }
  outputsReady(): void {
    this.outputs = true;
    this.schedule();
  }

  /** Cancels a not-yet-started backup; a running backup is still awaited by store shutdown. */
  dispose(): void {
    clearTimeout(this.timer);
    if (!this.settled) {
      this.settled = true;
      this.finish(false);
    }
  }

  private schedule(): void {
    if (
      this.settled ||
      this.timer !== undefined ||
      !this.service ||
      !this.outputs
    ) {
      return;
    }
    const due = performance.now() + IDLE_DELAY_MS;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (performance.now() - due > BUSY_DELAY_MS) {
        this.schedule();
        return;
      }
      this.settled = true;
      this.finish(true);
    }, IDLE_DELAY_MS);
  }
}
