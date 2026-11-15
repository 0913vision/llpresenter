/** The reason the control window and, for GPU loss, outputs need rebuilding. */
export type GraphicsRecoveryReason = 'control-hang' | 'gpu-loss';

/**
 * Serializes recovery requests. A GPU loss arriving during control recovery is
 * retained because outputs also need replacement; repeated identical requests
 * during a recovery are coalesced.
 */
export class GraphicsRecovery {
  private pending: GraphicsRecoveryReason | null = null;
  private active: GraphicsRecoveryReason | null = null;
  private stopped = false;

  constructor(
    private readonly recover: (reason: GraphicsRecoveryReason) => Promise<void>,
    private readonly failed: (error: unknown) => void,
  ) {}

  request(reason: GraphicsRecoveryReason): void {
    if (this.stopped) return;
    if (this.active !== null) {
      if (reason === 'gpu-loss' && this.active !== 'gpu-loss') {
        this.pending = 'gpu-loss';
      }
      return;
    }
    this.active = reason;
    this.run(reason).catch(this.failed);
  }

  stop(): void {
    this.stopped = true;
    this.pending = null;
  }

  private async run(reason: GraphicsRecoveryReason): Promise<void> {
    try {
      await this.recover(reason);
    } catch (error: unknown) {
      this.failed(error);
    } finally {
      this.active = null;
      const pending = this.pending;
      this.pending = null;
      if (pending !== null && !this.stopped) this.request(pending);
    }
  }
}
