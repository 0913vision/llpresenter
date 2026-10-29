import type {SoakSample} from './record.mts';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const KB_PER_MB = 1024;

const COVERAGE_TOLERANCE_MS = MS_PER_MINUTE;
const MAX_WARM_UP_SHARE = 1 / 12;
const MIN_WINDOW_COUNT = 4;
const MIN_WINDOW_MS = MS_PER_MINUTE;

/** Thresholds for judging one soak run. */
export interface JudgeOptions {
  /** How long the record must cover. */
  readonly requiredMs: number;
  /** Samples before this are startup and are not judged. */
  readonly warmUpMs: number;
  /** How many equal windows the time from `warmUpMs` to `requiredMs` is split into. */
  readonly windowCount: number;
  /** The fewest samples a window needs for its baseline to count. */
  readonly minSamplesPerWindow: number;
  /** The steepest rise of the lowest values, per hour, that still counts as flat. */
  readonly maxGrowthKbPerHour: number;
  /** An output whose median frame rate is below this gets a warning. */
  readonly minFps: number;
  /** Processes whose memory is reported but can't fail the run. */
  readonly reportedOnly: readonly string[];
}

/** The thresholds for the 60-minute soak test in `docs/TECH.md`. */
export const DEFAULT_JUDGE_OPTIONS: JudgeOptions = {
  requiredMs: 60 * MS_PER_MINUTE,
  warmUpMs: 5 * MS_PER_MINUTE,
  windowCount: 12,
  minSamplesPerWindow: 3,
  maxGrowthKbPerHour: 4 * KB_PER_MB,
  minFps: 58,
  reportedOnly: [],
};

/**
 * The default thresholds for a run of another length. The warm-up shrinks with
 * the run, and a short trial run gets fewer windows of at least a minute each,
 * so it still has samples to judge. It never gets fewer than four windows,
 * though: below about 4.4 minutes, the four windows are shorter than a minute
 * (27.5 seconds for a two-minute run).
 */
export function judgeOptionsFor(requiredMs: number): JudgeOptions {
  const warmUpMs = Math.min(
    DEFAULT_JUDGE_OPTIONS.warmUpMs,
    requiredMs * MAX_WARM_UP_SHARE,
  );
  const fitting = Math.floor((requiredMs - warmUpMs) / MIN_WINDOW_MS);
  const windowCount = Math.max(
    MIN_WINDOW_COUNT,
    Math.min(DEFAULT_JUDGE_OPTIONS.windowCount, fitting),
  );
  return {...DEFAULT_JUDGE_OPTIONS, requiredMs, warmUpMs, windowCount};
}

/**
 * Whether one process's memory stayed flat, kept growing, or can't be judged.
 * `reported` is a process the options list in `reportedOnly`: its growth is
 * shown, but it never fails the run.
 */
export type MemoryTrend = 'flat' | 'growing' | 'unjudged' | 'reported';

/** The memory verdict for one process. */
export interface MemoryVerdict {
  readonly name: string;
  readonly trend: MemoryTrend;
  /** The lowest private memory in each window, oldest first. */
  readonly baselinesKb: readonly number[];
  /** How fast the lowest values rise over the judged time, or `null` when unjudged. */
  readonly growthKbPerHour: number | null;
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

function lowest(points: readonly MemoryPoint[]): MemoryPoint | undefined {
  return points.reduce<MemoryPoint | undefined>(
    (low, point) =>
      low === undefined || point.privateKb < low.privateKb ? point : low,
    undefined,
  );
}

function windowBaselines(
  points: readonly MemoryPoint[],
  options: JudgeOptions,
): MemoryPoint[] | null {
  const {warmUpMs, requiredMs, windowCount} = options;
  const width = (requiredMs - warmUpMs) / windowCount;
  if (width <= 0) return null;
  const windows = Array.from({length: windowCount}, (): MemoryPoint[] => []);
  for (const point of points) {
    if (point.elapsedMs < warmUpMs || point.elapsedMs > requiredMs) continue;
    const index = Math.floor((point.elapsedMs - warmUpMs) / width);
    windows[Math.min(index, windowCount - 1)]?.push(point);
  }
  if (windows.some(w => w.length < options.minSamplesPerWindow)) return null;
  return windows.flatMap(w => lowest(w) ?? []);
}

// NOTE(0913vision): The Theil-Sen slope, the median of the slopes between
// every pair of points. One window whose lowest value dips or jumps moves only
// a few pairs, so it can't make flat memory fail or hide a steady rise.
function slopeKbPerHour(points: readonly MemoryPoint[]): number | null {
  const slopes = points.flatMap((from, index) =>
    points.slice(index + 1).flatMap(to => {
      const hours = (to.elapsedMs - from.elapsedMs) / MS_PER_HOUR;
      return hours === 0 ? [] : [(to.privateKb - from.privateKb) / hours];
    }),
  );
  return slopes.length === 0 ? null : median(slopes);
}

// NOTE(0913vision): Growth must hold over the whole judged time and over its
// later half. A cache that fills early and then levels off rises overall but
// not at the end; a leak rises in both. A fit without two distinct times
// can't be judged.
function memoryTrend(
  baselines: readonly MemoryPoint[],
  maxKbPerHour: number,
): MemoryTrend {
  const overall = slopeKbPerHour(baselines);
  const later = slopeKbPerHour(
    baselines.slice(Math.floor(baselines.length / 2)),
  );
  if (overall === null || later === null) return 'unjudged';
  return overall >= maxKbPerHour && later >= maxKbPerHour ? 'growing' : 'flat';
}

function measureMemory(
  name: string,
  points: readonly MemoryPoint[],
  options: JudgeOptions,
): MemoryVerdict {
  const baselines = windowBaselines(points, options);
  if (baselines === null) {
    return {name, trend: 'unjudged', baselinesKb: [], growthKbPerHour: null};
  }
  const trend = memoryTrend(baselines, options.maxGrowthKbPerHour);
  if (trend === 'unjudged') {
    return {name, trend, baselinesKb: [], growthKbPerHour: null};
  }
  return {
    name,
    trend,
    baselinesKb: baselines.map(b => b.privateKb),
    growthKbPerHour: slopeKbPerHour(baselines),
  };
}

function judgeMemory(
  name: string,
  points: readonly MemoryPoint[],
  options: JudgeOptions,
): MemoryVerdict {
  const verdict = measureMemory(name, points, options);
  return options.reportedOnly.includes(name)
    ? {...verdict, trend: 'reported'}
    : verdict;
}

function passes(verdict: MemoryVerdict): boolean {
  return verdict.trend === 'flat' || verdict.trend === 'reported';
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
 * growing: the robust slope through each window's lowest value rises at least
 * `maxGrowthKbPerHour`, over the whole judged time and over its later half.
 * Lowest values are used because garbage collection makes memory rise and fall
 * in between. The windows cover the required time,
 * not the time a process happened to be sampled, so a process that is missing
 * from part of the run can't be judged. A process in `reportedOnly` is
 * measured the same way but never fails the run.
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
    memory.every(passes) &&
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
