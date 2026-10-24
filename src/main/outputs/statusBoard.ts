import type {
  OutputScreenStatus,
  OutputStatuses,
} from '@shared/schema/outputStatus';
import type {FrameRate} from './frameRates';
import type {ScreenOutputState} from './manager';

/** Where the board reads each screen's state and frame rate. */
export interface StatusSources {
  readonly screenStates: () => ReadonlyMap<string, ScreenOutputState>;
  readonly frameRate: (screenId: string) => FrameRate | null;
}

export type StatusListener = (statuses: OutputStatuses) => void;

function sameStatus(a: OutputScreenStatus, b: OutputScreenStatus): boolean {
  return (
    a.placement === b.placement &&
    a.renderer === b.renderer &&
    a.fps === b.fps &&
    a.fpsLow === b.fpsLow
  );
}

function sameStatuses(a: OutputStatuses, b: OutputStatuses): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(key => {
      const left = a[key];
      const right = b[key];
      return (
        left !== undefined && right !== undefined && sameStatus(left, right)
      );
    })
  );
}

/**
 * The output status that the control window shows: each screen's placement,
 * its renderer state, and its frame rate (docs/spec/03-output.md and
 * 08-problems.md). It announces the status whenever it changes.
 */
export class OutputStatusBoard {
  private announced: OutputStatuses = {};
  private readonly listeners = new Set<StatusListener>();

  constructor(private readonly sources: StatusSources) {}

  snapshot(): OutputStatuses {
    const statuses: Record<string, OutputScreenStatus> = {};
    for (const [
      screenId,
      {placement, renderer},
    ] of this.sources.screenStates()) {
      const rate =
        placement === 'off' ? null : this.sources.frameRate(screenId);
      statuses[screenId] = {
        placement,
        renderer,
        fps: rate?.fps ?? null,
        fpsLow: rate?.status === 'low',
      };
    }
    return statuses;
  }

  /** Announces the status when it differs from the last one announced. */
  refresh(): void {
    const next = this.snapshot();
    if (sameStatuses(next, this.announced)) return;
    this.announced = next;
    for (const listener of this.listeners) listener(next);
  }

  /**
   * Calls the listener with every new status.
   *
   * @returns A function that removes the listener.
   */
  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
