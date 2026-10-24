import type {Logger} from '../log';

/** The record format version that `scripts/soak/run.mts` reads. */
export const SOAK_RECORD_VERSION = 1;

/** How often the recorder samples the process memory. */
export const SAMPLE_INTERVAL_MS = 10_000;

/** The longest delay `setTimeout` can wait; a longer one fires at once. */
export const MAX_EXIT_DELAY_MS = 2_147_483_647;

/** The fields of Electron's `ProcessMetric` that the recorder reads. */
export interface ProcessMetricLike {
  readonly pid: number;
  readonly type: string;
  readonly name?: string;
  readonly serviceName?: string;
  readonly memory: {
    readonly workingSetSize: number;
    readonly privateBytes?: number;
  };
}

/** One process in a record line, in KB. */
export interface ProcessSample {
  readonly name: string;
  readonly pid: number;
  readonly workingSetKb: number;
  readonly privateKb: number;
}

/** One output screen's last frame rate in a record line. */
export interface OutputFrameRate {
  readonly screen: string;
  readonly fps: number;
}

/** What the soak runner asked for through the environment. */
export interface SoakSettings {
  readonly recordPath: string;
  /** When the app quits by itself, or `null` to keep running. */
  readonly exitAfterMs: number | null;
}

/** Whether the soak runner asked for a record, and with what settings. */
export type SoakSettingsResult =
  | {readonly kind: 'off'}
  | {readonly kind: 'on'; readonly settings: SoakSettings}
  | {readonly kind: 'invalid'; readonly reason: string};

/** What the timer loop needs, so tests can replace Electron and the disk. */
export interface SoakRecording {
  readonly settings: SoakSettings;
  /** Builds one record line for the given time since the start. */
  readonly sample: (elapsedMs: number) => string;
  readonly append: (line: string) => Promise<void>;
  readonly quit: () => void;
  readonly now: () => number;
  readonly log: Logger;
}

/**
 * Reads the soak settings. Without `LLP_SOAK_EXIT_MS` the app keeps running;
 * otherwise it must be a whole number of milliseconds that `setTimeout` can
 * wait.
 */
export function readSoakSettings(env: NodeJS.ProcessEnv): SoakSettingsResult {
  const recordPath = env['LLP_SOAK_RECORD'] ?? '';
  if (recordPath === '') return {kind: 'off'};
  const exitText = env['LLP_SOAK_EXIT_MS'] ?? '';
  if (exitText === '') {
    return {kind: 'on', settings: {recordPath, exitAfterMs: null}};
  }
  const exitAfterMs = Number(exitText);
  const usable =
    Number.isInteger(exitAfterMs) &&
    exitAfterMs > 0 &&
    exitAfterMs <= MAX_EXIT_DELAY_MS;
  if (!usable) {
    return {
      kind: 'invalid',
      reason: `LLP_SOAK_EXIT_MS must be a whole number of milliseconds from 1 to ${MAX_EXIT_DELAY_MS}, not "${exitText}"`,
    };
  }
  return {kind: 'on', settings: {recordPath, exitAfterMs}};
}

/**
 * Names a renderer by the page it shows: `control` for `index.html`, and
 * `output:<screen>` for `output.html?screen=<screen>`.
 *
 * @returns the name, or `null` for a page the record doesn't track
 */
export function pageProcessName(url: string): string | null {
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  const page = parsed.pathname.split('/').at(-1);
  if (page === 'index.html') return 'control';
  if (page !== 'output.html') return null;
  const screen = parsed.searchParams.get('screen');
  return screen === null || screen === '' ? null : `output:${screen}`;
}

/**
 * Names a process so it keeps its name across samples and relaunches.
 *
 * @param rendererName - the name of the page a renderer process shows
 * @returns the name, or `null` for a process the record doesn't track
 */
export function processName(
  metric: ProcessMetricLike,
  rendererName: (pid: number) => string | null,
): string | null {
  switch (metric.type) {
    case 'Browser':
      return 'main';
    case 'GPU':
      return 'gpu';
    case 'Utility':
      return `utility:${metric.serviceName ?? metric.name ?? 'unnamed'}`;
    case 'Tab':
      return rendererName(metric.pid);
    default:
      return null;
  }
}

/** Turns Electron's process metrics into the record's process samples. */
export function processSamples(
  metrics: readonly ProcessMetricLike[],
  rendererName: (pid: number) => string | null,
): ProcessSample[] {
  return metrics.flatMap(metric => {
    const name = processName(metric, rendererName);
    if (name === null) return [];
    const {workingSetSize, privateBytes} = metric.memory;
    return [
      {
        name,
        pid: metric.pid,
        workingSetKb: workingSetSize,
        privateKb: privateBytes ?? workingSetSize,
      },
    ];
  });
}

/** Renders one record line (without the newline). */
export function sampleLine(
  elapsedMs: number,
  processes: readonly ProcessSample[],
  outputs: readonly OutputFrameRate[],
): string {
  return JSON.stringify({
    v: SOAK_RECORD_VERSION,
    elapsedMs: Math.round(elapsedMs),
    processes,
    outputs,
  });
}

/**
 * Samples every {@link SAMPLE_INTERVAL_MS} and appends each line in order,
 * then quits after `exitAfterMs`, once every queued line is written. A failed
 * write is logged and the recording goes on.
 *
 * @returns a function that stops the sampling and the quit timer, and resolves
 *   once every queued line is written
 */
export function startSoakRecording(
  recording: SoakRecording,
): () => Promise<void> {
  const startedAt = recording.now();
  let writes = Promise.resolve();
  const sampler = setInterval(() => {
    const line = recording.sample(recording.now() - startedAt);
    writes = writes
      .then(() => recording.append(`${line}\n`))
      .catch((error: unknown) => {
        recording.log.error('soak record write failed', error);
      });
  }, SAMPLE_INTERVAL_MS);
  let quitter: ReturnType<typeof setTimeout> | null = null;
  const stop = (): Promise<void> => {
    clearInterval(sampler);
    if (quitter !== null) clearTimeout(quitter);
    return writes;
  };
  const {exitAfterMs} = recording.settings;
  if (exitAfterMs !== null) {
    quitter = setTimeout(() => {
      stop().then(
        () => {
          recording.log.info('soak run finished; quitting');
          recording.quit();
        },
        (error: unknown) => {
          recording.log.error('soak record drain failed; quitting', error);
          recording.quit();
        },
      );
    }, exitAfterMs);
  }
  return stop;
}
