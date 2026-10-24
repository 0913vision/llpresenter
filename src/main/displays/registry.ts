import type {Logger} from '../log';
import {
  numberMonitors,
  sameMonitors,
  type DisplayInfo,
  type Monitor,
} from './monitor';

/** Where the monitor list comes from: Electron's `screen` in the app, a fake in tests. */
export interface DisplaySource {
  read(): readonly DisplayInfo[];
  /**
   * Calls the listener when a monitor connects, disconnects, or changes.
   *
   * @returns A function that stops watching.
   */
  watch(listener: () => void): () => void;
}

export type MonitorListener = (monitors: readonly Monitor[]) => void;

/**
 * How long the registry waits for a burst of display events to end before it
 * reads the monitors again. Windows sends several events for one plug.
 */
export const DISPLAY_SETTLE_MS = 300;

/** Keeps the list of connected monitors current and reports changes. */
export class DisplayRegistry {
  private current: readonly Monitor[];
  private readonly listeners = new Set<MonitorListener>();
  private readonly stopWatching: () => void;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly source: DisplaySource,
    private readonly log: Logger,
  ) {
    this.current = this.read() ?? [];
    this.stopWatching = source.watch(() => this.scheduleRefresh());
  }

  get monitors(): readonly Monitor[] {
    return this.current;
  }

  get listenerCount(): number {
    return this.listeners.size;
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

  /** Reads the monitors now, as 모니터 다시 찾기 (find monitor again) does. */
  refresh(): void {
    this.cancelSettle();
    const next = this.read();
    if (next === null || sameMonitors(next, this.current)) return;
    this.current = next;
    this.log.info('monitors changed', next);
    this.notify(next);
  }

  dispose(): void {
    this.cancelSettle();
    this.stopWatching();
    this.listeners.clear();
  }

  private scheduleRefresh(): void {
    this.cancelSettle();
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.refresh();
    }, DISPLAY_SETTLE_MS);
  }

  private cancelSettle(): void {
    if (this.settleTimer === null) return;
    clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  private read(): readonly Monitor[] | null {
    try {
      const monitors = numberMonitors(this.source.read());
      // NOTE(0913vision): Windows can report no monitors for a moment while
      // it reconfigures them. Moving every output for that would break the
      // picture, so the last list stays.
      if (monitors.length > 0) return monitors;
      this.log.warn('the system reported no monitors; keeping the last list');
    } catch (error) {
      this.log.error('could not read the monitors', error);
    }
    return null;
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
}
