const MS_PER_SECOND = 1000;

export const ELECTRON_STARTUP_DEADLINE_MS = 120 * MS_PER_SECOND;
export const PIXEL_CHECK_DEADLINE_MS = 30 * MS_PER_SECOND;
export const SYNTAX_CHECK_DEADLINE_MS = 30 * MS_PER_SECOND;
const PREPARATION_ALLOWANCE_MS = 60 * MS_PER_SECOND;
const SHUTDOWN_ALLOWANCE_MS = 10 * MS_PER_SECOND;
const VIEWPORT_COUNT = 2;

export const PIXEL_FIXTURE_PROCESS_DEADLINE_MS =
  VIEWPORT_COUNT * (ELECTRON_STARTUP_DEADLINE_MS + PIXEL_CHECK_DEADLINE_MS) +
  SHUTDOWN_ALLOWANCE_MS;
export const PIXEL_FIXTURE_TEST_DEADLINE_MS =
  PREPARATION_ALLOWANCE_MS +
  SYNTAX_CHECK_DEADLINE_MS +
  PIXEL_FIXTURE_PROCESS_DEADLINE_MS +
  SHUTDOWN_ALLOWANCE_MS;

type FixturePhase = 'startup' | 'pixels';

/** Keeps startup and pixel-check deadlines separate, and releases their timers. */
export function watchPixelFixture(onTimeout: (phase: FixturePhase) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const arm = (phase: FixturePhase): void => {
    if (disposed) return;
    clear();
    const delay =
      phase === 'startup'
        ? ELECTRON_STARTUP_DEADLINE_MS
        : PIXEL_CHECK_DEADLINE_MS;
    timer = setTimeout(() => {
      timer = null;
      disposed = true;
      onTimeout(phase);
    }, delay);
  };
  arm('startup');
  return {
    starting: (): void => arm('startup'),
    checking: (): void => arm('pixels'),
    dispose: (): void => {
      disposed = true;
      clear();
    },
  };
}

interface ProcessResult {
  readonly leftRunning: boolean;
}

/** Owns a fixture process until it has closed, including after a test aborts. */
export function ownPixelFixture<T extends ProcessResult>(
  run: (interrupt: AbortSignal) => Promise<T>,
) {
  const interrupt = new AbortController();
  const running = run(interrupt.signal);
  return {
    running,
    async stop(): Promise<void> {
      interrupt.abort();
      const result = await running;
      if (result.leftRunning) {
        throw new Error('The pixel fixture did not close its process tree');
      }
    },
  };
}
