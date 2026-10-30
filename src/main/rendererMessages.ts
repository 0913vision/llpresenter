import {
  parseFrameRateReport,
  parseRendererLogEntry,
  type FrameRateReport,
} from '@core/schema/ipcPayloads';
import {
  parseOutputRetryRequest,
  parseOutputShowWindowRequest,
} from '@core/schema/outputStatus';
import type {Logger} from './log';

/** A window's web contents id, which tells windows apart. */
export type WindowId = number;

/** A handler for one fire-and-forget message from a window. */
export type MessageHandler = (value: unknown, from: WindowId) => void;

/** How many log lines one window may write per second; more are counted and dropped. */
export const WINDOW_LOG_LINES_PER_SECOND = 20;

const RATE_PERIOD_MS = 1000;

const MAX_TRACKED_WINDOWS = 32;

interface WindowLogRate {
  readonly periodStart: number;
  readonly lines: number;
  readonly dropped: number;
}

/**
 * Keeps one window from filling the main log: each window may write
 * {@link WINDOW_LOG_LINES_PER_SECOND} lines a second. Lines over that are
 * dropped, and their count is logged when the window next writes. It
 * remembers 32 windows; the one heard from least recently is forgotten first.
 */
export class WindowLogLimiter {
  private readonly rates = new Map<WindowId, WindowLogRate>();

  constructor(
    private readonly log: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  /** @returns Whether this line from the window may go to the log. */
  admit(windowId: WindowId): boolean {
    const rate = this.currentPeriod(windowId);
    const admitted = rate.lines < WINDOW_LOG_LINES_PER_SECOND;
    this.remember(
      windowId,
      admitted
        ? {...rate, lines: rate.lines + 1}
        : {...rate, dropped: rate.dropped + 1},
    );
    return admitted;
  }

  private currentPeriod(windowId: WindowId): WindowLogRate {
    const time = this.now();
    const rate = this.rates.get(windowId);
    if (rate !== undefined && time - rate.periodStart < RATE_PERIOD_MS) {
      return rate;
    }
    if (rate !== undefined && rate.dropped > 0) {
      this.log.warn('dropped log lines from a window that logged too fast', {
        window: windowId,
        dropped: rate.dropped,
      });
    }
    return {periodStart: time, lines: 0, dropped: 0};
  }

  private remember(windowId: WindowId, rate: WindowLogRate): void {
    this.rates.delete(windowId);
    this.rates.set(windowId, rate);
    const [oldest] = this.rates.keys();
    if (this.rates.size > MAX_TRACKED_WINDOWS && oldest !== undefined) {
      this.rates.delete(oldest);
    }
  }
}

/**
 * Writes a window's log line to the main log, marked as coming from a window.
 * A malformed entry is dropped and reported, and a window that writes too
 * fast is held back by the limiter.
 */
export function handleLogWrite(
  log: Logger,
  limiter: WindowLogLimiter,
): MessageHandler {
  return (value, from) => {
    if (!limiter.admit(from)) return;
    const parsed = parseRendererLogEntry(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed log entry from a window', parsed.error);
      return;
    }
    const {level, message, detail} = parsed.value;
    log[level](`window: ${message}`, detail);
  };
}

/** Passes an output window's frame rate report on. A malformed report is dropped and reported. */
export function handleFrameRate(
  receive: (report: FrameRateReport) => void,
  log: Logger,
): MessageHandler {
  return value => {
    const parsed = parseFrameRateReport(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed frame rate report', parsed.error);
      return;
    }
    receive(parsed.value);
  };
}

interface ScreenRequestHandling {
  readonly name: string;
  readonly parse: typeof parseOutputRetryRequest;
  readonly act: (screenId: string) => void;
  readonly log: Logger;
}

function handleScreenRequest({
  name,
  parse,
  act,
  log,
}: ScreenRequestHandling): MessageHandler {
  return value => {
    const parsed = parse(value);
    if (!parsed.ok) {
      log.warn(`dropped a malformed ${name} request`, parsed.error);
      return;
    }
    act(parsed.value.screenId);
  };
}

/** Passes 다시 시도 for a screen on. A malformed request is dropped and reported. */
export function handleRetryRequest(
  retry: (screenId: string) => void,
  log: Logger,
): MessageHandler {
  return handleScreenRequest({
    name: 'retry',
    parse: parseOutputRetryRequest,
    act: retry,
    log,
  });
}

/** Passes 창 보기 for a screen on. A malformed request is dropped and reported. */
export function handleShowWindowRequest(
  show: (screenId: string) => void,
  log: Logger,
): MessageHandler {
  return handleScreenRequest({
    name: 'show window',
    parse: parseOutputShowWindowRequest,
    act: show,
    log,
  });
}
