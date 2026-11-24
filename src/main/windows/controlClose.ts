import {randomUUID} from 'node:crypto';
import {appEndpoints} from '@contracts/ipc/app';
import {closeStepAfter, type FlushOutcome} from '@core/app';
import {
  APP_FLUSH_LIMITS,
  type AppFlushDone,
  type AppFlushRequest,
} from '@core/schema/app/appFlush';
import {
  createAppFlushRequestId,
  type AppFlushRequestId,
} from '@core/schema/common/ids';
import {IpcHost, pushToWindow, type Caller} from '../base/ipcHost';
import type {Logger} from '../base/log';

type CloseListener = (event: {preventDefault(): void}) => void;

/** The part of the control window that the close handshake uses. */
export interface CloseableWindow {
  readonly webContents: {
    readonly id: number;
    isDestroyed(): boolean;
    send(channel: string, value: unknown): void;
    on(event: 'render-process-gone', listener: () => void): unknown;
    removeListener(event: 'render-process-gone', listener: () => void): unknown;
  };
  isDestroyed(): boolean;
  close(): void;
  on(event: 'close', listener: CloseListener): unknown;
  removeListener(event: 'close', listener: CloseListener): unknown;
}

/** The arguments of {@link registerControlClose}. */
export interface ControlCloseOptions {
  readonly control: CloseableWindow;
  readonly log: Logger;
  readonly timeoutMs?: number;
  /** Hides a dialog before its renderer and native window are released. */
  readonly beforeClose?: () => void;
  /** Replaces native close for a retained dialog after its flush succeeds. */
  readonly close?: () => void;
}

/** The control window's close handshake, for the quit path and disposal. */
export interface ControlClose {
  /**
   * Asks the control window to flush its edits, joining a request that is
   * already pending, and answers whether closing may go on. Missing progress
   * settles it within the flush bound. It never rejects.
   * When `requireSaved` is true, only an explicit successful flush permits an update.
   */
  confirmClose(requireSaved?: boolean): Promise<boolean>;
  /** Rearms the handshake after a retained dialog was hidden. */
  resume(): void;
  dispose(): void;
}

interface PendingFlush {
  readonly requestId: AppFlushRequestId;
  readonly outcome: Promise<FlushOutcome>;
  readonly settle: (outcome: FlushOutcome) => void;
}

class ControlCloseHandshake implements ControlClose {
  private pending: PendingFlush | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private confirmed = false;
  private flushed = false;
  private refused = false;
  private disposed = false;
  private readonly controlId: number;
  private readonly ipc: IpcHost;

  constructor(private readonly options: ControlCloseOptions) {
    const {control} = options;
    const contents = control.webContents;
    this.controlId = contents.id;
    const onClose: CloseListener = event => {
      this.handleClose(event);
    };
    const onGone = (): void => {
      this.pending?.settle('no-reply');
    };
    control.on('close', onClose);
    contents.on('render-process-gone', onGone);
    const ipc = new IpcHost(options.log);
    this.ipc = ipc;
    ipc.whenClosed(() => control.removeListener('close', onClose));
    ipc.whenClosed(() => {
      if (!contents.isDestroyed()) {
        contents.removeListener('render-process-gone', onGone);
      }
    });
    ipc.message(appEndpoints.flushDone, (done, caller) => {
      this.handleReply(done, caller);
    });
    ipc.message(appEndpoints.flushProgress, (progress, caller) => {
      this.handleProgress(progress, caller);
    });
    ipc.signal(appEndpoints.closeAnyway, caller => {
      this.handleCloseAnyway(caller);
    });
  }

  async confirmClose(requireSaved = false): Promise<boolean> {
    if (this.confirmed || this.disposed) {
      return !requireSaved || (this.flushed && !this.disposed);
    }
    const outcome = await (this.pending?.outcome ?? this.requestFlush());
    this.flushed = outcome === 'flushed';
    const closes = requireSaved
      ? this.flushed
      : closeStepAfter(outcome) === 'close';
    this.confirmed = closes;
    this.refused = !closes;
    return closes;
  }

  resume(): void {
    this.confirmed = false;
    this.flushed = false;
    this.refused = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending?.settle('no-reply');
    this.ipc.close();
  }

  private handleClose(event: {preventDefault(): void}): void {
    if (this.confirmed || this.disposed) return;
    event.preventDefault();
    this.confirmClose().then(
      closes => {
        if (closes) this.closeWindow();
      },
      (error: unknown) => {
        this.options.log.error(
          'could not confirm closing; closing anyway',
          error,
        );
        this.closeWindow();
      },
    );
  }

  private handleReply({requestId, result}: AppFlushDone, caller: Caller): void {
    const pending = this.pending;
    if (pending === null || !this.fromControl(caller)) return;
    if (requestId !== pending.requestId) {
      this.options.log.warn('ignored a reply to another flush request');
      return;
    }
    pending.settle(result ? 'flushed' : 'refused');
  }

  private handleProgress({requestId}: AppFlushRequest, caller: Caller): void {
    const pending = this.pending;
    if (pending === null || !this.fromControl(caller)) return;
    if (requestId === pending.requestId) this.armTimeout(pending);
  }

  private handleCloseAnyway(caller: Caller): void {
    if (this.pending === null && !this.refused) return;
    if (!this.fromControl(caller)) return;
    if (this.pending !== null) {
      this.options.log.info('closing the control window before its flush ends');
      this.pending.settle('forced');
      return;
    }
    if (!this.refused) return;
    this.refused = false;
    this.confirmed = true;
    this.options.log.info('closing the control window after a refused flush');
    this.closeWindow();
  }

  private fromControl({contents}: Caller): boolean {
    if (contents.id === this.controlId) return true;
    this.options.log.warn('ignored a close message of another window');
    return false;
  }

  private requestFlush(): Promise<FlushOutcome> {
    const {control, log} = this.options;
    if (control.isDestroyed() || control.webContents.isDestroyed()) {
      return Promise.resolve('no-reply');
    }
    const requestId = createAppFlushRequestId(randomUUID());
    let settle: (outcome: FlushOutcome) => void = () => undefined;
    const outcome = new Promise<FlushOutcome>(resolve => {
      settle = resolve;
    });
    const pending: PendingFlush = {
      requestId,
      outcome,
      settle: result => {
        if (this.pending !== pending) return;
        clearTimeout(this.timer);
        this.pending = null;
        settle(result);
      },
    };
    this.pending = pending;
    this.armTimeout(pending);
    const sent = pushToWindow(control.webContents, appEndpoints.flushRequests, {
      value: {requestId},
      log,
    });
    if (!sent) pending.settle('no-reply');
    return outcome;
  }

  private armTimeout(pending: PendingFlush): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.options.log.warn(
        'the control window did not answer the flush request in time',
      );
      pending.settle('no-reply');
    }, this.options.timeoutMs ?? APP_FLUSH_LIMITS.timeoutMs);
  }

  private closeWindow(): void {
    if (this.options.control.isDestroyed()) return;
    this.options.beforeClose?.();
    if (this.options.close === undefined) this.options.control.close();
    else this.options.close();
  }
}

/**
 * Makes the control window flush its edits before it closes, whether the
 * close comes from the window or from quitting. A refused flush keeps the
 * window open until a later close or 강제로 닫기, which also ends a flush that
 * is still running; a missing answer closes after
 * `APP_FLUSH_LIMITS.timeoutMs` (`closeStepAfter`). Only messages from this
 * window's web contents count.
 */
export function registerControlClose(
  options: ControlCloseOptions,
): ControlClose {
  return new ControlCloseHandshake(options);
}
