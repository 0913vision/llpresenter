import {
  parseFrameRateReport,
  parseRendererLogEntry,
} from '@shared/schema/ipcPayloads';
import type {Logger} from './log';
import type {FrameRateTracker} from './outputs/frameRates';

/** A handler for one fire-and-forget message from a window. */
export type MessageHandler = (value: unknown) => void;

/**
 * Writes a window's log line to the main log, marked as coming from a window.
 * A malformed entry is dropped and reported.
 */
export function handleLogWrite(log: Logger): MessageHandler {
  return value => {
    const parsed = parseRendererLogEntry(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed log entry from a window', parsed.error);
      return;
    }
    const {level, message, detail} = parsed.value;
    log[level](`window: ${message}`, detail);
  };
}

/** Passes an output window's frame rate to the tracker. A malformed report is dropped and reported. */
export function handleFrameRate(
  tracker: FrameRateTracker,
  log: Logger,
): MessageHandler {
  return value => {
    const parsed = parseFrameRateReport(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed frame rate report', parsed.error);
      return;
    }
    tracker.report(parsed.value);
  };
}
