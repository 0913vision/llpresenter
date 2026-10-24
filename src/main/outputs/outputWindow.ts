import {sameRect, type Rect} from '../displays/rect';
import type {Logger} from '../log';
import type {FullScreenPlacement, ShownPlacement} from './placement';
import {CRASH_LIMIT, RestartBudget} from './restartBudget';
import type {OutputScreen} from './screens';

/** The Electron window of one output, reduced to what the output needs. */
export interface OutputWindowHandle {
  /** Shows the window without taking focus, full screen on the monitor with these bounds. */
  showFullScreen(monitorBounds: Rect, alwaysOnTop: boolean): void;
  /** Shows the window without taking focus as a normal window, moved to the bounds when given. */
  showWindowed(bounds: Rect | null): void;
  hide(): void;
  /** Loads the page again, in a new renderer process if the old one died. */
  reload(): void;
  isRendererGone(): boolean;
  destroy(): void;
}

export interface OutputWindowEvents {
  readonly onRendererGone: (reason: string) => void;
  /** The operator clicked the close button of a window-mode output. */
  readonly onCloseRequested: () => void;
}

export type CreateOutputWindowHandle = (
  screen: OutputScreen,
  events: OutputWindowEvents,
) => OutputWindowHandle;

/** How long after a renderer crash the page loads again. Spec 08 asks for under 1 second. */
export const RELAUNCH_DELAY_MS = 100;

/** The arguments of the {@link OutputWindow} constructor. */
export interface OutputWindowOptions {
  readonly screen: OutputScreen;
  readonly createHandle: CreateOutputWindowHandle;
  readonly onCloseRequested: () => void;
  readonly log: Logger;
}

function sameFullScreen(
  applied: ShownPlacement | null,
  next: FullScreenPlacement,
): boolean {
  return (
    applied?.kind === 'fullscreen' &&
    sameRect(applied.bounds, next.bounds) &&
    applied.alwaysOnTop === next.alwaysOnTop
  );
}

/**
 * One screen's output window. It creates the window the first time the output
 * turns on, keeps it across hides, moves it when the placement changes, and
 * restarts its renderer after a crash.
 */
export class OutputWindow {
  private handle: OutputWindowHandle | null = null;
  private applied: ShownPlacement | null = null;
  private visible = false;
  private disposed = false;
  private relaunchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly budget = new RestartBudget();

  constructor(private readonly options: OutputWindowOptions) {}

  /** Shows the window at the placement, or hides it for null. */
  update(placement: ShownPlacement | null): void {
    if (this.disposed) return;
    if (placement === null) this.hide();
    else this.show(placement);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelRelaunch();
    this.handle?.destroy();
    this.handle = null;
  }

  private show(placement: ShownPlacement): void {
    const handle = this.ensureHandle();
    if (!this.visible) {
      this.retryIfGone(handle);
      this.place(handle, placement);
    } else if (this.changes(placement)) {
      this.place(handle, placement);
    }
    this.applied = placement;
    this.visible = true;
  }

  private changes(placement: ShownPlacement): boolean {
    if (placement.kind === 'window') return this.applied?.kind !== 'window';
    return !sameFullScreen(this.applied, placement);
  }

  private place(handle: OutputWindowHandle, placement: ShownPlacement): void {
    if (placement.kind === 'fullscreen') {
      handle.showFullScreen(placement.bounds, placement.alwaysOnTop);
      return;
    }
    // NOTE(0913vision): A window that is already in window mode keeps the
    // bounds the operator may have dragged it to.
    const alreadyWindowed = this.applied?.kind === 'window';
    handle.showWindowed(alreadyWindowed ? null : placement.bounds);
  }

  private hide(): void {
    if (!this.visible || this.handle === null) return;
    this.handle.hide();
    this.visible = false;
  }

  private ensureHandle(): OutputWindowHandle {
    if (this.handle !== null) return this.handle;
    const handle = this.options.createHandle(this.options.screen, {
      onRendererGone: reason => this.handleRendererGone(reason),
      onCloseRequested: this.options.onCloseRequested,
    });
    this.handle = handle;
    return handle;
  }

  private retryIfGone(handle: OutputWindowHandle): void {
    if (!handle.isRendererGone()) return;
    this.options.log.info('reloading a crashed output window', {
      screen: this.options.screen.id,
    });
    this.budget.reset();
    this.cancelRelaunch();
    handle.reload();
  }

  private handleRendererGone(reason: string): void {
    if (this.disposed) return;
    const screen = this.options.screen.id;
    if (!this.budget.recordCrash()) {
      this.options.log.error(
        'stopped restarting an output window after repeated crashes',
        {screen, reason, limit: CRASH_LIMIT},
      );
      return;
    }
    this.options.log.error('output window process gone, restarting it', {
      screen,
      reason,
    });
    this.cancelRelaunch();
    this.relaunchTimer = setTimeout(() => {
      this.relaunchTimer = null;
      this.handle?.reload();
    }, RELAUNCH_DELAY_MS);
  }

  private cancelRelaunch(): void {
    if (this.relaunchTimer === null) return;
    clearTimeout(this.relaunchTimer);
    this.relaunchTimer = null;
  }
}
