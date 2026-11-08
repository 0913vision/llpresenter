import type {MonitorIdentity} from '@core/schema/monitorIdentity';
import type {Logger} from '../log';
import {numberMonitors, sameMonitors, type DisplayInfo} from './monitor';
import {
  DISPLAY_SETTLE_MS,
  type DisplayChange,
  type DisplaySource,
} from './registry';
import {sameRect, type Rect} from './rect';
import type {NativeMonitorIdentity} from '@core/schema/windowsMonitors';

interface IdentitySourceOptions {
  readonly source: DisplaySource;
  readonly query: (
    signal: AbortSignal,
  ) => Promise<readonly NativeMonitorIdentity[]>;
  readonly pixelBounds: (display: DisplayInfo) => Rect;
  readonly log: Logger;
}

function samePixels(a: Rect, b: Rect, tolerance: number): boolean {
  return (['x', 'y', 'width', 'height'] as const).every(
    key => Math.abs(a[key] - b[key]) <= tolerance,
  );
}

/** Attaches identity only when current pixel rectangles form a one-to-one join. */
export function joinMonitorIdentities(
  displays: readonly DisplayInfo[],
  native: readonly NativeMonitorIdentity[],
  pixelBounds: IdentitySourceOptions['pixelBounds'],
): ReadonlyMap<number, MonitorIdentity> {
  const candidates = displays.map(display => ({
    id: display.id,
    found: native.filter(row =>
      samePixels(
        pixelBounds(display),
        row.bounds,
        Math.ceil(display.scaleFactor),
      ),
    ),
  }));
  const result = new Map<number, MonitorIdentity>();
  for (const {id, found} of candidates) {
    const [only] = found;
    if (found.length !== 1 || only === undefined) continue;
    if (
      candidates.filter(candidate => candidate.found.includes(only)).length !==
      1
    ) {
      continue;
    }
    if (only.identity !== undefined) result.set(id, only.identity);
  }
  return result;
}

/** One cached, cancellable query at launch and after each settled topology change. */
export class IdentityDisplaySource implements DisplaySource {
  private cache: ReadonlyMap<number, MonitorIdentity> = new Map();
  private verified: readonly DisplayInfo[] = [];
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | undefined;
  private pending = true;
  private known = false;
  private warned = false;
  private retried = false;
  private stopped = false;
  private listener: ((change: DisplayChange) => void) | undefined;

  constructor(private readonly options: IdentitySourceOptions) {}

  read(): readonly DisplayInfo[] {
    return this.options.source.read().map(display => {
      const identity = this.identityFor(display);
      return {
        ...display,
        identityPending: this.pending,
        identityUnknown: !this.known,
        ...(identity === undefined ? {} : {identity}),
      };
    });
  }

  watch(listener: (change: DisplayChange) => void): () => void {
    this.listener = listener;
    this.warnFallback();
    const stop = this.options.source.watch(change => {
      this.generation++;
      this.retried = false;
      this.retainUnchanged(change);
      this.controller?.abort();
      this.pending = true;
      this.known = false;
      this.warnFallback();
      this.schedule(DISPLAY_SETTLE_MS);
      listener(change);
    });
    this.schedule(0);
    return () => {
      this.stopped = true;
      this.generation++;
      clearTimeout(this.timer);
      this.controller?.abort();
      this.cache = new Map();
      this.verified = [];
      this.listener = undefined;
      stop();
    };
  }

  private schedule(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.refresh().catch((error: unknown) =>
        this.options.log.error('could not publish monitor identities', error),
      );
    }, delay);
  }

  private async refresh(): Promise<void> {
    const generation = this.generation;
    if (!this.isCurrent(generation) || this.controller !== undefined) return;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const before = this.options.source.read();
      const native = await this.options.query(controller.signal);
      if (!this.isCurrent(generation)) return;
      const after = this.options.source.read();
      if (!sameMonitors(numberMonitors(before), numberMonitors(after))) {
        if (this.retried) throw new Error('Monitor topology did not settle');
        this.retried = true;
        this.generation++;
        this.schedule(DISPLAY_SETTLE_MS);
        return;
      }
      this.cache = joinMonitorIdentities(
        after,
        native,
        this.options.pixelBounds,
      );
      this.verified = after;
      this.known = true;
      this.warned = false;
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.known = false;
      this.warnFallback(error);
    } finally {
      this.controller = undefined;
      if (this.isCurrent(generation)) {
        this.pending = false;
        this.listener?.({kind: 'changed'});
      } else if (!this.stopped && this.timer === undefined) {
        this.schedule(DISPLAY_SETTLE_MS);
      }
    }
  }

  private isCurrent(generation: number): boolean {
    return !this.stopped && generation === this.generation;
  }

  private identityFor(display: DisplayInfo): MonitorIdentity | undefined {
    const previous = this.verified.find(entry => entry.id === display.id);
    return previous?.scaleFactor === display.scaleFactor &&
      sameRect(previous.bounds, display.bounds)
      ? this.cache.get(display.id)
      : undefined;
  }

  private retainUnchanged(change: DisplayChange): void {
    const retained = new Map<number, MonitorIdentity>();
    try {
      for (const display of this.options.source.read()) {
        if (change.kind === 'removed' && change.id === display.id) continue;
        const identity = this.identityFor(display);
        if (identity !== undefined) retained.set(display.id, identity);
      }
    } catch {
      // NOTE(0913vision): Without current rectangles, no cached identity is safe.
    }
    this.cache = retained;
  }

  private warnFallback(error?: unknown): void {
    if (this.warned) return;
    this.warned = true;
    this.options.log.warn(
      'monitor identity unavailable; using legacy matching until a query succeeds',
      error,
    );
  }
}
