import {sameRect, type Rect} from '../displays/rect';
import type {Logger} from '../log';
import type {FullScreenPlacement, ShownPlacement} from './placement';
import {ANSWER_LIMIT_MS, FRAME_SILENCE_MS, HangWatch} from './hangWatch';
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
  /**
   * Loads the page again, in a new renderer process if the old one died.
   * Rejects when the page fails to load.
   */
  reload(): Promise<void>;
  /** Ends a hung renderer process, so the crash path starts it again. */
  crashRenderer(): void;
  /**
   * Asks the page's main thread for an answer. Resolves when it answers;
   * never resolves while it is stuck.
   */
  ping(): Promise<void>;
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
  /** Hears every change of the renderer state. */
  readonly onRendererState?: (state: RendererState) => void;
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
  private drewSinceLoad = false;
  private readonly recovery: RendererRecovery;
  private readonly hangWatch = new HangWatch({
    ping: () => this.handle?.ping() ?? Promise.resolve(),
    onHung: () => this.handleHang(),
    onSilentButAnswering: () => this.reportSilence(),
  });

  constructor(private readonly options: OutputWindowOptions) {
    this.recovery = new RendererRecovery({
      screenId: options.screen.id,
      reload: () => this.reloadPage(),
      log: options.log,
      ...(options.onRendererState === undefined
        ? {}
        : {onStateChange: options.onRendererState}),
    });
  }

  get rendererState(): RendererState {
    return this.recovery.state;
  }

  /**
   * The page reported its frame rate: it has drawn the output state since its
   * last load, and it is still drawing.
   */
  frameReported(): void {
    this.drewSinceLoad = true;
    this.recovery.pageDrawn();
    this.watchIfRunning();
  }

  /** 다시 시도: while the restart limit waits, an attempt starts at once. */
  retry(): void {
    this.recovery.retry();
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
    this.hangWatch.stop();
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
    if (!this.visible) {
      this.visible = true;
      this.watchIfRunning();
    }
  }

  private watchIfRunning(): void {
    // NOTE(0913vision): Only a page that has drawn since its last load is
    // watched. A page that hasn't drawn yet is loading, and the recovery's
    // draw limit covers a reload.
    if (!this.visible || !this.drewSinceLoad) return;
    if (this.recovery.state !== 'running') return;
    this.hangWatch.beat();
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
    this.hangWatch.stop();
    this.recovery.pause();
  }

  private reloadPage(): Promise<void> {
    return this.handle?.reload() ?? Promise.resolve();
  }

  private ensureHandle(): OutputWindowHandle {
    if (this.handle !== null) return this.handle;
    const handle = this.options.createHandle(this.options.screen, {
      onRendererGone: details => {
        this.drewSinceLoad = false;
        this.hangWatch.pageReplaced();
        if (!this.disposed) this.recovery.crashed(details);
      },
      onCloseRequested: this.options.onCloseRequested,
    });
    this.handle = handle;
    return handle;
  }

  private reportSilence(): void {
    this.options.log.warn('output window answers but reports no frames', {
      screen: this.options.screen.id,
      silentForMs: FRAME_SILENCE_MS,
    });
  }

  private handleHang(): void {
    this.options.log.error(
      'output window stopped drawing and answering; restarting its renderer',
      {
        screen: this.options.screen.id,
        silentForMs: FRAME_SILENCE_MS + ANSWER_LIMIT_MS,
      },
    );
    this.handle?.crashRenderer();
    // NOTE(0913vision): A renderer that survives the forced crash sends no
    // render-process-gone, so the watch tries again after another timeout.
    this.hangWatch.beat();
  }
}
