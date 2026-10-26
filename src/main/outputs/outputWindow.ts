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
  configure(screen: OutputScreen): void;
  prepare(bounds: Rect): void;
  /** Shows the window without taking focus, full screen on the monitor with these bounds. */
  showFullScreen(monitorBounds: Rect, alwaysOnTop: boolean): void;
  /** Shows the window without taking focus as a normal window, moved to the bounds when given. */
  showWindowed(bounds: Rect | null, alwaysOnTop?: boolean): void;
  /** Shows fixed-resolution capture content without minimizing or taking focus. */
  showCapture(contentBounds: Rect, alwaysOnTop?: boolean): void;
  /** Drops always on top and places the control directly above this output without focus. */
  prepareForMonitorRemoval(): void;
  /**
   * Raises the shown window above the other windows without taking focus,
   * restoring it first when it is minimized, and keeps it raised through the
   * placement work still running when it was asked.
   */
  bringToFront(): void;
  /** Where the window is now on screen, or null while it never shows. */
  bounds(): Rect | null;
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
  readonly liveVersion: () => number;
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
 * One screen's preloaded output window. It stays hidden until the current
 * complete frame is ready, keeps it across hides, moves it when placement changes, and
 * brings its renderer back after crashes.
 */
export class OutputWindow {
  private screen: OutputScreen;
  private handle: OutputWindowHandle | null = null;
  private applied: ShownPlacement | null = null;
  private visible = false;
  private disposed = false;
  private drewSinceLoad = false;
  private readyVersion = -1;
  private wanted: ShownPlacement | null = null;
  private prepared: ShownPlacement | null = null;
  private readonly recovery: RendererRecovery;
  private readonly hangWatch = new HangWatch({
    ping: () => this.handle?.ping() ?? Promise.resolve(),
    onHung: () => this.handleHang(),
    onSilentButAnswering: () => this.reportSilence(),
  });

  constructor(private readonly options: OutputWindowOptions) {
    this.screen = options.screen;
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

  preload(): void {
    if (!this.disposed) this.ensureHandle();
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

  frameReady(version: number): boolean {
    if (this.disposed || version !== this.options.liveVersion()) return false;
    this.readyVersion = version;
    this.frameReported();
    if (!this.visible && this.wanted !== null) this.show(this.wanted);
    return this.visible;
  }

  /** 다시 시도: while the restart limit waits, an attempt starts at once. */
  retry(): void {
    this.recovery.retry();
  }

  /** Shows the window at the placement, or hides it for null. */
  update(placement: ShownPlacement | null, screen = this.screen): void {
    const changed = screen !== this.screen;
    this.screen = screen;
    if (this.disposed) return;
    this.ensureHandle();
    if (changed) this.handle?.configure(screen);
    this.wanted = placement;
    if (placement === null) this.hide();
    else this.show(placement);
  }

  prepareForMonitorRemoval(): void {
    if (this.disposed || !this.visible || this.applied?.kind !== 'fullscreen') {
      return;
    }
    this.applied = null;
    this.handle?.prepareForMonitorRemoval();
  }

  /** 창 보기: raises the window only while it shows as a normal window. */
  bringToFront(): void {
    if (this.disposed || !this.visible || this.applied?.kind !== 'window') {
      return;
    }
    this.handle?.bringToFront();
  }

  /** Where a shown capture window is now, which other windows must not cover. */
  captureArea(): Rect | null {
    if (this.disposed || !this.visible || this.applied?.kind !== 'capture') {
      return null;
    }
    return this.handle?.bounds() ?? null;
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
    if (
      !this.visible &&
      !this.keepsOperatorBounds(placement) &&
      (this.prepared?.kind !== placement.kind ||
        !sameRect(this.prepared.bounds, placement.bounds))
    ) {
      handle.prepare(placement.bounds);
      this.prepared = placement;
      this.readyVersion = -1;
    }
    if (!this.visible && this.readyVersion !== this.options.liveVersion()) {
      return;
    }
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
    if (placement.kind === 'capture') {
      return (
        this.applied?.kind !== 'capture' ||
        !sameRect(this.applied.bounds, placement.bounds) ||
        !!this.applied.alwaysOnTop !== !!placement.alwaysOnTop
      );
    }
    if (placement.kind === 'window') {
      return (
        this.applied?.kind !== 'window' ||
        !!this.applied.alwaysOnTop !== !!placement.alwaysOnTop ||
        (placement.reason === 'monitorMissing' &&
          (this.applied.reason !== 'monitorMissing' ||
            !sameRect(this.applied.bounds, placement.bounds)))
      );
    }
    return !sameFullScreen(this.applied, placement);
  }

  private place(handle: OutputWindowHandle, placement: ShownPlacement): void {
    if (placement.kind === 'capture') {
      handle.showCapture(placement.bounds, placement.alwaysOnTop ?? false);
      return;
    }
    if (placement.kind === 'fullscreen') {
      handle.showFullScreen(placement.bounds, placement.alwaysOnTop);
      return;
    }
    // NOTE(0913vision): Normal windows keep an operator's placement. A lost
    // monitor fallback follows later work-area changes as Windows settles.
    handle.showWindowed(
      this.keepsOperatorBounds(placement) ? null : placement.bounds,
      placement.alwaysOnTop ?? false,
    );
  }

  private keepsOperatorBounds(placement: ShownPlacement): boolean {
    const previous = this.applied;
    return (
      placement.kind === 'window' &&
      previous?.kind === 'window' &&
      (placement.reason === 'method' ||
        (previous.reason === 'monitorMissing' &&
          sameRect(previous.bounds, placement.bounds)))
    );
  }

  private hide(): void {
    if (!this.visible || this.handle === null) return;
    this.handle.hide();
    this.visible = false;
    this.hangWatch.stop();
  }

  private reloadPage(): Promise<void> {
    return this.handle?.reload() ?? Promise.resolve();
  }

  private ensureHandle(): OutputWindowHandle {
    if (this.handle !== null) return this.handle;
    const handle = this.options.createHandle(this.screen, {
      onRendererGone: details => {
        this.drewSinceLoad = false;
        this.readyVersion = -1;
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
