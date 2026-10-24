import {flushWithin, type Logger} from './log';

/** How long quitting waits for the log to reach the disk. */
export const QUIT_FLUSH_LIMIT_MS = 2000;

/** The part of Electron's `app` that quitting needs. */
export interface QuittingApp {
  on(
    event: 'will-quit',
    listener: (event: {preventDefault(): void}) => void,
  ): unknown;
  quit(): void;
}

/**
 * Holds the app's quit until every queued log line is on the disk, or until
 * the limit passes, so the last lines of a session are never lost and a stuck
 * disk can't keep the app from quitting.
 */
export function flushLogBeforeQuit(
  app: QuittingApp,
  log: Logger,
  limitMs = QUIT_FLUSH_LIMIT_MS,
): void {
  let flushed = false;
  const finish = (problem: unknown): void => {
    if (problem !== null) {
      console.error('quitting before the log reached the disk', problem);
    }
    flushed = true;
    app.quit();
  };
  app.on('will-quit', event => {
    if (flushed) return;
    event.preventDefault();
    flushWithin(log, limitMs).then(
      written => finish(written ? null : `no flush within ${limitMs} ms`),
      (error: unknown) => finish(error),
    );
  });
}
