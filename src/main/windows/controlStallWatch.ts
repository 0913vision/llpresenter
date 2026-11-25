import type {Rectangle} from 'electron';
import type {Logger} from '../base/log';
import type {WindowMode} from '../base/renderers/windowMode';
import {ControlHeartbeat} from './controlHeartbeat';
import {
  LATE_DISPLAY_CHANGE_MS,
  stallNeedsRecovery,
  watchDisplayChanges,
} from './displayStall';

const ONE_PIXEL: Rectangle = {x: 0, y: 0, width: 1, height: 1};

/** What the stall watch uses of the control window. */
export interface StallWatchedWindow {
  isDestroyed(): boolean;
  isVisible(): boolean;
  isMinimized(): boolean;
  once(event: 'closed', listener: () => void): unknown;
  readonly webContents: {
    executeJavaScript(code: string): Promise<unknown>;
    capturePage(rect: Rectangle): Promise<unknown>;
    on(
      event: 'did-start-loading' | 'did-finish-load',
      listener: () => void,
    ): unknown;
  };
}

/** What the stall watch reports to and reads from outside. */
export interface StallWatchOptions {
  readonly windowMode: WindowMode;
  /**
   * The window stopped answering.
   *
   * @param scriptAnswered - Whether only its picture did.
   */
  readonly onHang: (scriptAnswered: boolean) => void;
  readonly log: Logger;
  /** When the monitors last changed; by default watched on the screen. */
  readonly displays?: {
    readonly last: () => number | null;
    readonly stop: () => void;
  };
  readonly now?: () => number;
}

/**
 * Watches the control window while its page is loaded: its script must
 * answer, and a window that is drawn must also give a picture. A window
 * whose script does not answer is hung. One whose script answers but that
 * draws nothing waits {@link LATE_DISPLAY_CHANGE_MS} for a display change
 * Windows reports late; it is hung unless the monitors just changed, and
 * then it is watched again from the start. The watch ends with the window.
 */
export function watchControlStall(
  win: StallWatchedWindow,
  {
    windowMode,
    onHang,
    log,
    displays = watchDisplayChanges(),
    now = Date.now,
  }: StallWatchOptions,
): void {
  let scriptAnswered = false;
  let settling: ReturnType<typeof setTimeout> | undefined;
  const drawsNothing = (): void => {
    settling = undefined;
    if (win.isDestroyed()) return;
    const lastDisplayChange = displays.last();
    if (
      stallNeedsRecovery({scriptAnswered: true, lastDisplayChange, now: now()})
    ) {
      onHang(true);
      return;
    }
    log.warn('control window drew nothing while the displays changed', {
      sinceChangeMs: now() - (lastDisplayChange ?? 0),
    });
    heartbeat.stop();
    heartbeat.start();
  };
  const stalled = (): void => {
    if (!scriptAnswered) {
      onHang(false);
      return;
    }
    settling = setTimeout(drawsNothing, LATE_DISPLAY_CHANGE_MS);
  };
  const heartbeat = new ControlHeartbeat(
    () => {
      scriptAnswered = false;
      const answer = win.webContents.executeJavaScript('0').then(() => {
        scriptAnswered = true;
      });
      const draws =
        windowMode === 'offscreen' || (win.isVisible() && !win.isMinimized());
      return draws
        ? Promise.all([answer, win.webContents.capturePage(ONE_PIXEL)])
        : answer;
    },
    stalled,
    now,
  );
  win.webContents.on('did-start-loading', () => heartbeat.stop());
  win.webContents.on('did-finish-load', () => heartbeat.start());
  win.once('closed', () => {
    heartbeat.stop();
    if (settling !== undefined) clearTimeout(settling);
    displays.stop();
  });
}
