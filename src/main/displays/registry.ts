import type {Logger} from '../log';
import {
  numberMonitors,
  sameMonitors,
  type DisplayInfo,
  type Monitor,
} from './monitor';

export type DisplayChange =
  {readonly kind: 'changed'} | {readonly kind: 'removed'; readonly id: number};

/** Where the monitor list comes from: Electron's `screen` in the app, a fake in tests. */
export interface DisplaySource {
  read(): readonly DisplayInfo[];
  /**
   * Calls the listener when a monitor connects, disconnects, or changes.
   *
   * @returns A function that stops watching.
   */
  watch(listener: (change: DisplayChange) => void): () => void;
}

export type MonitorListener = (monitors: readonly Monitor[]) => void;
export type MonitorRemovedListener = (monitorId: number) => void;

/**
 * How long the registry waits for a burst of display events to end before it
 * reads the monitors again. Windows sends several events for one plug.
 */
export const DISPLAY_SETTLE_MS = 300;

/**
 * How long the registry waits to read again after an empty or failed read,
 * because no display event may come once the system recovers.
 */
export const DISPLAY_RETRY_MS = 1000;

type ReadProblemLevel = 'warn' | 'error';

/** Keeps the list of connected monitors current and reports changes. */
export class DisplayRegistry {
  private current: readonly Monitor[] = [];
  private readonly listeners = new Set<MonitorListener>();
  private readonly removalListeners = new Set<MonitorRemovedListener>();
  private readonly stopWatching: () => void;
  private pendingRead: ReturnType<typeof setTimeout> | null = null;
  private readFailing = false;
  private removalPending = false;

  constructor(
    private readonly source: DisplaySource,
    private readonly log: Logger,
  ) {
    this.stopWatching = source.watch(change => {
      if (change.kind === 'removed') {
        this.removalPending = true;
        this.notifyRemoved(change.id);
      }
      this.scheduleRead(DISPLAY_SETTLE_MS);
    });
    this.refresh();
  }

  get monitors(): readonly Monitor[] {
    return this.current;
  }

  get listenerCount(): number {
    return this.listeners.size + this.removalListeners.size;
  }

  /**
   * Calls the listener whenever the monitor list changes.
   *
   * @returns A function that removes the listener. Always call it.
   */
  subscribe(listener: MonitorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Reports the removed monitor immediately, before waiting for displays to settle. */
  subscribeRemoved(listener: MonitorRemovedListener): () => void {
    this.removalListeners.add(listener);
    return () => {
      this.removalListeners.delete(listener);
    };
  }

  /**
   * Reads the monitors now, as 모니터 다시 찾기 (find monitor again) does. An
   * empty or failed read keeps the last list and tries again later.
   */
  refresh(): void {
    this.cancelPendingRead();
    const next = this.read();
    if (next === null) {
      this.scheduleRead(DISPLAY_RETRY_MS);
      return;
    }
    const changed = !sameMonitors(next, this.current);
    if (!changed && !this.removalPending) return;
    this.removalPending = false;
    this.current = next;
    if (changed) this.log.info('monitors changed', next);
    this.notify(next);
  }

  dispose(): void {
    this.cancelPendingRead();
    this.stopWatching();
    this.listeners.clear();
    this.removalListeners.clear();
  }

  private scheduleRead(delayMs: number): void {
    this.cancelPendingRead();
    this.pendingRead = setTimeout(() => {
      this.pendingRead = null;
      this.refresh();
    }, delayMs);
  }

  private cancelPendingRead(): void {
    if (this.pendingRead === null) return;
    clearTimeout(this.pendingRead);
    this.pendingRead = null;
  }

  private read(): readonly Monitor[] | null {
    try {
      const monitors = numberMonitors(this.source.read());
      // NOTE(0913vision): Windows can report no monitors for a moment while
      // it reconfigures them. Moving every output for that would break the
      // picture, so the last list stays.
      if (monitors.length > 0) {
        this.markReadable();
        return monitors;
      }
      this.reportReadProblem(
        'warn',
        'the system reported no monitors; keeping the last list',
      );
    } catch (error) {
      this.reportReadProblem('error', 'could not read the monitors', error);
    }
    return null;
  }

  private reportReadProblem(
    level: ReadProblemLevel,
    message: string,
    detail?: unknown,
  ): void {
    if (this.readFailing) return;
    this.readFailing = true;
    this.log[level](message, detail);
  }

  private markReadable(): void {
    if (!this.readFailing) return;
    this.readFailing = false;
    this.log.info('the monitors can be read again');
  }

  private notify(monitors: readonly Monitor[]): void {
    for (const listener of this.listeners) {
      try {
        listener(monitors);
      } catch (error) {
        this.log.error('a monitor listener failed', error);
      }
    }
  }

  private notifyRemoved(monitorId: number): void {
    for (const listener of this.removalListeners) {
      try {
        listener(monitorId);
      } catch (error) {
        this.log.error('a monitor removal listener failed', error);
      }
    }
  }
}
