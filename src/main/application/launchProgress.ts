import type {BrowserWindow} from 'electron';
import type {Logger} from '../base/log';
import {completeSplashStep, type StartupStep} from '../windows/splash';

/** The stages of the launch, on the splash window and in the log. */
export class LaunchProgress {
  private readonly reported = new Set<StartupStep>();

  constructor(
    private readonly splash: BrowserWindow,
    private readonly log: Logger,
  ) {}

  /** Whether the splash window is still there. */
  get isShown(): boolean {
    return !this.splash.isDestroyed();
  }

  /** A stage is complete; only its first time counts. */
  report(step: StartupStep): void {
    if (this.reported.has(step)) return;
    this.reported.add(step);
    this.log.info('launch stage complete', {
      step,
      uptimeMs: Math.round(process.uptime() * 1000),
    });
    completeSplashStep(this.splash, step);
  }

  /** A stage is complete once something is there. */
  reportWhen(step: StartupStep, ready: Promise<unknown>): void {
    ready
      .then(() => this.report(step))
      .catch((error: unknown) =>
        this.log.error(`${step} startup failed`, error),
      );
  }

  /** Takes the splash window away. */
  end(): void {
    if (this.isShown) this.splash.close();
  }
}
