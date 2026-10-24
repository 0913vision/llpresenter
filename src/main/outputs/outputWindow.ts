import {sameRect, type Rect} from '../displays/rect';
import type {Logger} from '../log';
import type {FullScreenPlacement, ShownPlacement} from './placement';
import {
  RendererRecovery,
  type RendererGoneDetails,
  type RendererState,
} from './rendererRecovery';
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
  destroy(): void;
}

export interface OutputWindowEvents {
  readonly onRendererGone: (details: RendererGoneDetails) => void;
  /** The operator clicked the close button of a window-mode output. */
  readonly onCloseRequested: () => void;
}

export type CreateOutputWindowHandle = (
  screen: OutputScreen,
  events: OutputWindowEvents,
) => OutputWindowHandle;

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
 * brings its renderer back after crashes.
 */
export class OutputWindow {
  private handle: OutputWindowHandle | null = null;
  private applied: ShownPlacement | null = null;
  private visible = false;
  private disposed = false;
  private readonly recovery: RendererRecovery;

  constructor(private readonly options: OutputWindowOptions) {
    this.recovery = new RendererRecovery({
      screenId: options.screen.id,
      reload: () => this.handle?.reload(),
      log: options.log,
    });
  }

  get rendererState(): RendererState {
    return this.recovery.state;
  }

  /** The page drew the output state after a (re)load. */
  pageDrawn(): void {
    this.recovery.pageDrawn();
  }

  /** Shows the window at the placement, or hides it for null. */
  update(placement: ShownPlacement | null): void {
    if (this.disposed) return;
    if (placement === null) this.hide();
    else this.show(placement);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.recovery.dispose();
    this.handle?.destroy();
    this.handle = null;
  }

  private show(placement: ShownPlacement): void {
    const handle = this.ensureHandle();
    if (!this.visible) {
      this.recovery.resume();
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
    this.recovery.pause();
  }

  private ensureHandle(): OutputWindowHandle {
    if (this.handle !== null) return this.handle;
    const handle = this.options.createHandle(this.options.screen, {
      onRendererGone: details => {
        if (!this.disposed) this.recovery.crashed(details);
      },
      onCloseRequested: this.options.onCloseRequested,
    });
    this.handle = handle;
    return handle;
  }
}
