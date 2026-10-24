import type {SoakSample} from './record.mts';

const MS_PER_MINUTE = 60_000;
const KB_PER_MB = 1024;

/** How close to the required length the record must reach. */
const COVERAGE_TOLERANCE_MS = MS_PER_MINUTE;

/** Thresholds for judging one soak run. */
export interface JudgeOptions {
  /** How long the record must cover. */
  readonly requiredMs: number;
  /** Samples before this are startup and are not judged. */
  readonly warmUpMs: number;
  /** How many equal time windows the judged span is split into. */
  readonly windowCount: number;
  /** The fewest samples a window needs for its baseline to count. */
  readonly minSamplesPerWindow: number;
  /** Growth below this over the whole run is noise, even if every window rises. */
  readonly minGrowthKb: number;
  /** An output whose median frame rate is below this gets a warning. */
  readonly minFps: number;
}

/** The thresholds for the 60-minute soak test in `docs/TECH.md`. */
export const DEFAULT_JUDGE_OPTIONS: JudgeOptions = {
  requiredMs: 60 * MS_PER_MINUTE,
  warmUpMs: 5 * MS_PER_MINUTE,
  windowCount: 6,
  minSamplesPerWindow: 3,
  minGrowthKb: 10 * KB_PER_MB,
  minFps: 58,
};

/** Whether one process's memory stayed flat, kept growing, or can't be judged. */
export type MemoryTrend = 'flat' | 'growing' | 'unjudged';

/** The memory verdict for one process. */
export interface MemoryVerdict {
  readonly name: string;
  readonly trend: MemoryTrend;
  /** The lowest private memory in each window, oldest first. */
  readonly baselinesKb: readonly number[];
}

/** How many times a process came back with a new pid. */
export interface Relaunch {
  readonly name: string;
  readonly count: number;
}

/** One output window's frame rate after warm-up. */
export interface FpsSummary {
  readonly screen: string;
  readonly medianFps: number;
  readonly lowestFps: number;
  readonly belowTarget: boolean;
}

/** Everything the runner reports about one soak run. */
export interface SoakVerdict {
  readonly passed: boolean;
  readonly coveredMs: number;
  readonly longEnough: boolean;
  readonly memory: readonly MemoryVerdict[];
  readonly relaunches: readonly Relaunch[];
  readonly fps: readonly FpsSummary[];
}

interface MemoryPoint {
  readonly elapsedMs: number;
  readonly pid: number;
  readonly privateKb: number;
}

function memorySeries(
  samples: readonly SoakSample[],
): Map<string, MemoryPoint[]> {
  const series = new Map<string, MemoryPoint[]>();
  for (const {elapsedMs, processes} of samples) {
    for (const {name, pid, privateKb} of processes) {
      const points = series.get(name) ?? [];
      points.push({elapsedMs, pid, privateKb});
      series.set(name, points);
    }
  }
  return series;
}

function windowBaselines(
  points: readonly MemoryPoint[],
  options: JudgeOptions,
): number[] | null {
  const judged = points.filter(p => p.elapsedMs >= options.warmUpMs);
  const start = judged.at(0)?.elapsedMs ?? 0;
  const width = ((judged.at(-1)?.elapsedMs ?? 0) - start) / options.windowCount;
  if (width <= 0) return null;
  const windows = Array.from({length: options.windowCount}, (): number[] => []);
  for (const {elapsedMs, privateKb} of judged) {
    const index = Math.floor((elapsedMs - start) / width);
    windows[Math.min(index, options.windowCount - 1)]?.push(privateKb);
  }
  if (windows.some(w => w.length < options.minSamplesPerWindow)) return null;
  return windows.map(w => Math.min(...w));
}

function keepsGrowing(
  baselines: readonly number[],
  minGrowthKb: number,
): boolean {
  const risesEveryWindow = baselines.every(
    (value, index) => index === 0 || value > (baselines[index - 1] ?? value),
  );
  const growth = (baselines.at(-1) ?? 0) - (baselines.at(0) ?? 0);
  return risesEveryWindow && growth >= minGrowthKb;
}

function judgeMemory(
  name: string,
  points: readonly MemoryPoint[],
  options: JudgeOptions,
): MemoryVerdict {
  const baselines = windowBaselines(points, options);
  if (baselines === null) return {name, trend: 'unjudged', baselinesKb: []};
  const trend = keepsGrowing(baselines, options.minGrowthKb)
    ? 'growing'
    : 'flat';
  return {name, trend, baselinesKb: baselines};
}

function countRelaunches(points: readonly MemoryPoint[]): number {
  return points.filter(
    (point, index) => index > 0 && point.pid !== points[index - 1]?.pid,
  ).length;
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function summarizeFps(
  samples: readonly SoakSample[],
  options: JudgeOptions,
): FpsSummary[] {
  const byScreen = new Map<string, number[]>();
  for (const {elapsedMs, outputs} of samples) {
    if (elapsedMs < options.warmUpMs) continue;
    for (const {screen, fps} of outputs) {
      byScreen.set(screen, [...(byScreen.get(screen) ?? []), fps]);
    }
  }
  return [...byScreen].map(([screen, values]) => {
    const medianFps = median(values);
    return {
      screen,
      medianFps,
      lowestFps: Math.min(...values),
      belowTarget: medianFps < options.minFps,
    };
  });
}

/**
 * Judges a soak record. The run fails when the record is too short, when a
 * process relaunched, or when a process's memory can't be judged or kept
 * growing: its lowest value rose in every window and by at least
 * `minGrowthKb` overall. Lowest values are used because garbage collection
 * makes memory rise and fall in between.
 */
export function judgeRun(
  samples: readonly SoakSample[],
  options: JudgeOptions = DEFAULT_JUDGE_OPTIONS,
): SoakVerdict {
  const ordered = samples.toSorted((a, b) => a.elapsedMs - b.elapsedMs);
  const coveredMs = ordered.at(-1)?.elapsedMs ?? 0;
  const longEnough = coveredMs >= options.requiredMs - COVERAGE_TOLERANCE_MS;
  const series = [...memorySeries(ordered)];
  const memory = series.map(([name, points]) =>
    judgeMemory(name, points, options),
  );
  const relaunches = series
    .map(([name, points]) => ({name, count: countRelaunches(points)}))
    .filter(relaunch => relaunch.count > 0);
  const passed =
    longEnough &&
    memory.length > 0 &&
    memory.every(verdict => verdict.trend === 'flat') &&
    relaunches.length === 0;
  return {
    passed,
    coveredMs,
    longEnough,
    memory,
    relaunches,
    fps: summarizeFps(ordered, options),
  };
}
