import {isResizeLoopNotice} from '@core/common/browserNotices';
import type {Logger} from '../log';

/** The most console errors one window writes to the log in a minute. */
export const CONSOLE_ERRORS_PER_MINUTE = 30;

const MINUTE_MS = 60_000;

/** The console message event of a page, as Electron sends it. */
interface ConsoleMessage {
  readonly level: 'info' | 'warning' | 'error' | 'debug';
  readonly message: string;
  readonly sourceId: string;
  readonly lineNumber: number;
}

/** The part of a window's web contents that tells its console messages. */
export interface ConsoleSource {
  on(
    event: 'console-message',
    listener: (details: ConsoleMessage) => void,
  ): unknown;
  off(
    event: 'console-message',
    listener: (details: ConsoleMessage) => void,
  ): unknown;
}

/**
 * Writes the console errors of a window's page to the app log, so a failure
 * that the page only printed is in the log on the church PC. An uncaught error
 * is left to the page, which logs it with its stack, and the browser's
 * ResizeObserver loop notice is no failure. At most
 * {@link CONSOLE_ERRORS_PER_MINUTE} a minute are written; the rest of that
 * minute is counted and written as one line, so a failure repeated every frame
 * can't fill the log.
 *
 * @returns A function that stops it.
 */
export function logConsoleErrors(
  contents: ConsoleSource,
  {
    window,
    log,
    now = Date.now,
  }: {
    /** The window's name in the log, such as `control window`. */
    readonly window: string;
    readonly log: Logger;
    readonly now?: () => number;
  },
): () => void {
  let minuteStart = now();
  let written = 0;
  let dropped = 0;
  const startMinute = (time: number): void => {
    if (dropped > 0) {
      log.warn(`dropped console errors of the ${window}`, {count: dropped});
    }
    minuteStart = time;
    written = 0;
    dropped = 0;
  };
  const listener = (details: ConsoleMessage): void => {
    if (
      details.level !== 'error' ||
      details.message.startsWith('Uncaught') ||
      isResizeLoopNotice(details.message)
    ) {
      return;
    }
    const time = now();
    if (time - minuteStart >= MINUTE_MS) startMinute(time);
    if (written >= CONSOLE_ERRORS_PER_MINUTE) {
      dropped += 1;
      return;
    }
    written += 1;
    log.error(`console error in the ${window}`, {
      message: details.message,
      source: `${details.sourceId}:${details.lineNumber}`,
    });
  };
  contents.on('console-message', listener);
  return () => {
    contents.off('console-message', listener);
  };
}
