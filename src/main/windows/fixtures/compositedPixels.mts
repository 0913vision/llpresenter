export const FRAME_CAPTURE_POLL_MS = 25;
export const COMPOSITED_FRAME_DEADLINE_MS = 5000;
export const PIXEL_CHANNEL_TOLERANCE = 1;

export interface PixelSample {
  readonly transparent: readonly number[];
  readonly translucent: readonly number[];
  readonly opaque: readonly number[];
}

export interface ExpectedPixels {
  readonly transparent: number;
  readonly translucent: number;
  readonly opaque: number;
}

interface PixelCheck {
  readonly capture: () => Promise<PixelSample>;
  readonly expected: ExpectedPixels;
  readonly phase: string;
}

type CheckResult =
  | {readonly ok: true; readonly pixels: PixelSample}
  | {readonly ok: false; readonly error: Error};

const BANDS = ['transparent', 'translucent', 'opaque'] as const;

function matches(sample: PixelSample, expected: ExpectedPixels): boolean {
  return BANDS.every(
    band =>
      sample[band].length === 3 &&
      sample[band].every(
        value => Math.abs(value - expected[band]) <= PIXEL_CHANNEL_TOLERANCE,
      ),
  );
}

function lastPixels(
  sample: PixelSample | null,
  expected: ExpectedPixels,
): string {
  return BANDS.map(
    band =>
      `${band}: expected ${expected[band]}, received ${
        sample === null ? 'no capture' : `[${sample[band].join(', ')}]`
      }`,
  ).join('; ');
}

/** Waits for every pixel band to match, with the last sample on timeout. */
export function waitForCompositedPixels({
  capture,
  expected,
  phase,
}: PixelCheck): Promise<PixelSample> {
  return new Promise((resolve, reject) => {
    let sample: PixelSample | null = null;
    let settled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const deadline = setTimeout(() => {
      finish({
        ok: false,
        error: new Error(
          `${phase}: no matching composited frame within ${COMPOSITED_FRAME_DEADLINE_MS} ms; last pixels: ${lastPixels(sample, expected)}`,
        ),
      });
    }, COMPOSITED_FRAME_DEADLINE_MS);

    function finish(result: CheckResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (retry !== null) clearTimeout(retry);
      if (result.ok) resolve(result.pixels);
      else reject(result.error);
    }

    function poll(): void {
      Promise.resolve()
        .then(capture)
        .then(
          observed => {
            if (settled) return;
            sample = observed;
            if (matches(observed, expected)) {
              finish({ok: true, pixels: observed});
              return;
            }
            retry = setTimeout(() => {
              retry = null;
              poll();
            }, FRAME_CAPTURE_POLL_MS);
          },
          (error: unknown) =>
            finish({
              ok: false,
              error: error instanceof Error ? error : new Error(String(error)),
            }),
        );
    }

    poll();
  });
}
