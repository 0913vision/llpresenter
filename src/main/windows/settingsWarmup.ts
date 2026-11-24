import type {SettingsRequest} from '@contracts/ipc/window';

/** A view and page of the settings window. */
export type SettingsTarget = Pick<SettingsRequest, 'view' | 'page'>;

/** How long after the control window loads the settings window is prepared. */
const WARMUP_DELAY_MS = 1000;

/**
 * Prepares the hidden settings window a moment after the control window loads,
 * and then draws its views one after another, so the first open shows a page
 * that is already drawn.
 */
export class SettingsWarmup {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private targets: SettingsTarget[] = [];

  /** Runs `prepare` after the delay, in place of a run that still waits. */
  schedule(prepare: () => void): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      prepare();
    }, WARMUP_DELAY_MS);
  }

  /** Stops a run that still waits. */
  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Sets the views to draw in turn while the window stays hidden. */
  plan(targets: readonly SettingsTarget[]): void {
    this.targets = [...targets];
  }

  /** The next view to draw, if any is left. */
  next(): SettingsTarget | undefined {
    return this.targets.shift();
  }

  /** Drops the views left, as when the operator asks for a view. */
  stop(): void {
    this.targets = [];
  }
}
