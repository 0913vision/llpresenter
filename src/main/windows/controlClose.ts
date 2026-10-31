import {randomUUID} from 'node:crypto';
import {ipcMain, type IpcMainEvent} from 'electron';
import {appEndpoints} from '@contracts/ipc/app';
import {closeStepAfter, type FlushOutcome} from '@core/app/closePolicy';
import {
  APP_FLUSH_LIMITS,
  parseAppFlushDone,
  parseAppFlushRequest,
} from '@core/schema/appFlush';
import {
  createAppFlushRequestId,
  type AppFlushRequestId,
} from '@core/schema/ids';
import type {Logger} from '../log';

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
}

/** The control window's close handshake, for the quit path and disposal. */
export interface ControlClose {
  /**
   * Asks the control window to flush its edits, joining a request that is
   * already pending, and answers whether closing may go on. Missing progress
   * settles it within the flush bound. It never rejects.
   */
  confirmClose(): Promise<boolean>;
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
  private refused = false;
  private disposed = false;
  private readonly controlId: number;
  private readonly stops: Array<() => void> = [];

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
    const onDone = (event: IpcMainEvent, value: unknown): void => {
      this.handleReply(event, value);
    };
    const onCloseAnyway = (event: IpcMainEvent): void => {
      this.handleCloseAnyway(event);
    };
    const onProgress = (event: IpcMainEvent, value: unknown): void => {
      const pending = this.pending;
      if (pending === null) return;
      if (!this.fromControl(event, appEndpoints.flushProgress.channel)) return;
      const parsed = parseAppFlushRequest(value);
      if (!parsed.ok) {
        this.options.log.warn('ignored malformed flush progress', parsed.error);
        return;
      }
      if (parsed.value.requestId === pending.requestId) {
        this.armTimeout(pending);
      }
    };
    control.on('close', onClose);
    contents.on('render-process-gone', onGone);
    ipcMain.on(appEndpoints.flushDone.channel, onDone);
    ipcMain.on(appEndpoints.closeAnyway.channel, onCloseAnyway);
    ipcMain.on(appEndpoints.flushProgress.channel, onProgress);
    this.stops.push(
      () => control.removeListener('close', onClose),
      () => {
        if (!contents.isDestroyed()) {
          contents.removeListener('render-process-gone', onGone);
        }
      },
      () => ipcMain.removeListener(appEndpoints.flushDone.channel, onDone),
      () =>
        ipcMain.removeListener(appEndpoints.closeAnyway.channel, onCloseAnyway),
      () =>
        ipcMain.removeListener(appEndpoints.flushProgress.channel, onProgress),
    );
  }

  async confirmClose(): Promise<boolean> {
    if (this.confirmed || this.disposed) return true;
    const outcome = await (this.pending?.outcome ?? this.requestFlush());
    const closes = closeStepAfter(outcome) === 'close';
    this.confirmed = closes;
    this.refused = !closes;
    return closes;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending?.settle('no-reply');
    for (const stop of this.stops) stop();
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

  private handleReply(event: IpcMainEvent, value: unknown): void {
    const pending = this.pending;
    if (pending === null) return;
    if (!this.fromControl(event, appEndpoints.flushDone.channel)) return;
    const parsed = parseAppFlushDone(value, pending.requestId);
    if (!parsed.ok) {
      this.options.log.warn('ignored a malformed flush reply', parsed.error);
      return;
    }
    pending.settle(parsed.value.result ? 'flushed' : 'refused');
  }

  private handleCloseAnyway(event: IpcMainEvent): void {
    if (this.pending === null && !this.refused) return;
    if (!this.fromControl(event, appEndpoints.closeAnyway.channel)) return;
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

  private fromControl(event: IpcMainEvent, channel: string): boolean {
    if (event.sender.id === this.controlId) return true;
    this.options.log.warn(`ignored ${channel} from another window`);
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
    try {
      control.webContents.send(appEndpoints.flushRequests.channel, {requestId});
    } catch (error) {
      log.warn('could not ask the control window to flush', error);
      pending.settle('no-reply');
    }
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
    if (!this.options.control.isDestroyed()) this.options.control.close();
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
