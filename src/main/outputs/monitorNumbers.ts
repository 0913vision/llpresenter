import type {Monitor} from '../displays/monitor';
import {
  centeredRect,
  intersectionArea,
  sameRect,
  type Rect,
} from '../displays/rect';
import type {MonitorNumbersPort} from '../live/slice';
import type {Logger} from '../log';

/** How long 모니터 번호 표시 shows the numbers (docs/spec/06-settings.md). */
export const MONITOR_NUMBER_MS = 3000;

/** The side of a number square in DIP (docs/spec/06-settings.md). */
export const MONITOR_NUMBER_SIDE = 240;

const CORNER_INSET = 48;

/** Where one monitor's number shows. */
export interface NumberSpot {
  readonly number: number;
  readonly bounds: Rect;
}

export interface NumberWindow {
  close(): void;
}

interface MonitorNumbersOptions {
  readonly monitors: () => readonly Monitor[];
  readonly avoid: () => readonly Rect[];
  readonly open: (spot: NumberSpot) => NumberWindow;
  readonly log: Logger;
}

function candidates({bounds}: Monitor): readonly Rect[] {
  const side = MONITOR_NUMBER_SIDE;
  const left = bounds.x + CORNER_INSET;
  const top = bounds.y + CORNER_INSET;
  const right = bounds.x + bounds.width - CORNER_INSET - side;
  const bottom = bounds.y + bounds.height - CORNER_INSET - side;
  const square = (x: number, y: number): Rect => ({
    x,
    y,
    width: side,
    height: side,
  });
  return [
    centeredRect(bounds, {width: side, height: side}),
    square(left, top),
    square(right, top),
    square(left, bottom),
    square(right, bottom),
  ];
}

/**
 * The spot of each monitor's number: its centre, or else the first corner
 * that covers none of the areas to avoid. A monitor whose every spot covers
 * one shows no number.
 */
export function numberSpots(
  monitors: readonly Monitor[],
  avoid: readonly Rect[],
): readonly NumberSpot[] {
  return monitors.flatMap(monitor => {
    const free = candidates(monitor).find(rect =>
      avoid.every(area => intersectionArea(rect, area) === 0),
    );
    return free === undefined ? [] : [{number: monitor.number, bounds: free}];
  });
}

function sameSpots(
  a: readonly NumberSpot[],
  b: readonly NumberSpot[],
): boolean {
  return (
    a.length === b.length &&
    a.every((spot, index) => {
      const other = b[index];
      return (
        other?.number === spot.number && sameRect(other.bounds, spot.bounds)
      );
    })
  );
}

interface ShownNumber {
  readonly spot: NumberSpot;
  readonly window: NumberWindow;
}

/**
 * 모니터 번호 표시: one number window per monitor for
 * {@link MONITOR_NUMBER_MS}. Showing them again while they show keeps the
 * same windows and starts the time over, unless the monitors or the areas to
 * avoid changed. A window that fails to open or close is logged and skipped.
 */
export class MonitorNumbers implements MonitorNumbersPort {
  private shown: readonly ShownNumber[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: MonitorNumbersOptions) {}

  identify(): void {
    const spots = numberSpots(this.options.monitors(), this.options.avoid());
    if (
      !sameSpots(
        spots,
        this.shown.map(({spot}) => spot),
      )
    ) {
      this.closeAll();
      this.shown = spots.flatMap(spot => this.openAt(spot));
    }
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.closeAll(), MONITOR_NUMBER_MS);
  }

  dispose(): void {
    this.closeAll();
  }

  private openAt(spot: NumberSpot): readonly ShownNumber[] {
    try {
      return [{spot, window: this.options.open(spot)}];
    } catch (error) {
      this.options.log.error('could not show a monitor number', error);
      return [];
    }
  }

  private closeAll(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    for (const {window} of this.shown) {
      try {
        window.close();
      } catch (error) {
        this.options.log.error('could not close a monitor number', error);
      }
    }
    this.shown = [];
  }
}
