/** How often an output reports frames or idle health (spec 03). */
export const REPORT_INTERVAL_MS = 1000;

const MS_PER_SECOND = 1000;
const FPS_DECIMALS = 10;

export interface FrameRateMeterOptions {
  readonly onFrame?: (time: number) => void;
  readonly report: (fps: number) => void;
  readonly active?: () => boolean;
  readonly reportIdle?: () => void;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

export interface FrameRateMeter {
  readonly refresh: () => void;
  readonly stop: () => void;
}

/** Samples moving frames; static outputs report health once a second instead. */
export function startFrameRateMeter({
  report,
  onFrame: onFrameReady,
  active = () => true,
  reportIdle,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}: FrameRateMeterOptions): FrameRateMeter {
  let periodStart: number | null = null;
  let frames = 0;
  let handle: number | null = null;
  let stopped = false;
  const sampling = (): boolean => !stopped && handle !== null;
  const onFrame = (time: number): void => {
    if (!sampling()) return;
    handle = requestFrame(onFrame);
    onFrameReady?.(time);
    if (!sampling()) return;
    if (periodStart === null) {
      periodStart = time;
      return;
    }
    frames += 1;
    const elapsed = time - periodStart;
    if (elapsed < REPORT_INTERVAL_MS) return;
    const fps = (frames * MS_PER_SECOND) / elapsed;
    report(Math.round(fps * FPS_DECIMALS) / FPS_DECIMALS);
    periodStart = time;
    frames = 0;
  };
  const refresh = (): void => {
    if (stopped) return;
    if (active()) {
      handle ??= requestFrame(onFrame);
    } else {
      const wasSampling = handle !== null;
      if (handle !== null) cancelFrame(handle);
      handle = null;
      periodStart = null;
      frames = 0;
      if (wasSampling) reportIdle?.();
    }
  };
  const timer = setInterval(() => {
    const wasSampling = handle !== null;
    refresh();
    if (handle === null && !wasSampling) reportIdle?.();
  }, REPORT_INTERVAL_MS);
  refresh();
  return {
    refresh,
    stop: () => {
      stopped = true;
      clearInterval(timer);
      if (handle !== null) cancelFrame(handle);
      handle = null;
    },
  };
}
