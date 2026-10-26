import type {MonitorInfo, MonitorList} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';

/** A monitor's box in the display layout, placed in percent of the whole. */
export interface MonitorBox {
  readonly number: number;
  readonly name: string;
  readonly resolution: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** The names of the screens that show full screen on this monitor. */
  readonly screens: readonly string[];
  readonly control: boolean;
  readonly selected: boolean;
}

/** A screen that has no monitor, such as a capture window. */
export interface TargetBox {
  readonly id: string;
  readonly name: string;
  readonly resolution: string | undefined;
  readonly selected: boolean;
}

export interface DisplayLayoutModel {
  /** The width over the height of the whole arrangement. */
  readonly aspectRatio: number;
  readonly monitors: readonly MonitorBox[];
  readonly targets: readonly TargetBox[];
}

const PERCENT = 100;

function resolutionText(size: {
  readonly width: number;
  readonly height: number;
}): string {
  return `${size.width} × ${size.height}`;
}

function arrangement(monitors: MonitorList) {
  const left = Math.min(...monitors.map(({bounds}) => bounds.x));
  const top = Math.min(...monitors.map(({bounds}) => bounds.y));
  const right = Math.max(
    ...monitors.map(({bounds}) => bounds.x + bounds.width),
  );
  const bottom = Math.max(
    ...monitors.map(({bounds}) => bounds.y + bounds.height),
  );
  return {left, top, width: right - left, height: bottom - top};
}

interface BoxContext {
  readonly whole: ReturnType<typeof arrangement>;
  readonly screens: readonly Screen[];
  readonly selected: Screen | undefined;
}

function monitorBox(
  monitor: MonitorInfo,
  {whole, screens, selected}: BoxContext,
): MonitorBox {
  const {bounds} = monitor;
  const shown = screens.filter(
    screen =>
      screen.method === 'fullscreen' &&
      screen.display?.number === monitor.number,
  );
  return {
    number: monitor.number,
    name: monitor.name,
    resolution: resolutionText(bounds),
    left: ((bounds.x - whole.left) / whole.width) * PERCENT,
    top: ((bounds.y - whole.top) / whole.height) * PERCENT,
    width: (bounds.width / whole.width) * PERCENT,
    height: (bounds.height / whole.height) * PERCENT,
    screens: shown.map(screen => screen.name),
    control: monitor.hasMainWindow,
    selected: selected !== undefined && shown.includes(selected),
  };
}

function targetBoxes(
  screens: readonly Screen[],
  selected: Screen | undefined,
): readonly TargetBox[] {
  return screens
    .filter(screen => screen.method !== 'fullscreen')
    .map(screen => ({
      id: screen.id,
      name: screen.name,
      resolution:
        screen.resolution === undefined
          ? undefined
          : resolutionText(screen.resolution),
      selected: screen === selected,
    }));
}

/**
 * Places one box per monitor like the Windows arrangement, and lists the
 * screens without a monitor apart. `selectedId` marks the selected screen's
 * monitor or target.
 */
export function displayLayout(
  monitors: MonitorList,
  screens: readonly Screen[],
  selectedId: string | undefined,
): DisplayLayoutModel {
  const selected = screens.find(screen => screen.id === selectedId);
  const targets = targetBoxes(screens, selected);
  if (monitors.length === 0) return {aspectRatio: 1, monitors: [], targets};
  const whole = arrangement(monitors);
  return {
    aspectRatio: whole.width / whole.height,
    monitors: monitors.map(monitor =>
      monitorBox(monitor, {whole, screens, selected}),
    ),
    targets,
  };
}
