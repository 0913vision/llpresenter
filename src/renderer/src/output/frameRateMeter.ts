/** How often the meter reports. Spec 03 asks for once a second. */
export const REPORT_INTERVAL_MS = 1000;

const MS_PER_SECOND = 1000;
const FPS_DECIMALS = 10;

export interface FrameRateMeterOptions {
  readonly report: (fps: number) => void;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

/**
 * Counts the frames the window draws and reports the rate, to one decimal,
 * once a second (docs/spec/03-output.md, previews and frame rate).
 *
 * @returns A function that stops measuring.
 */
export function startFrameRateMeter({
  report,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}: FrameRateMeterOptions): () => void {
  let periodStart: number | null = null;
  let frames = 0;
  let handle = 0;
  const onFrame = (time: number): void => {
    handle = requestFrame(onFrame);
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
  handle = requestFrame(onFrame);
  return () => cancelFrame(handle);
}
