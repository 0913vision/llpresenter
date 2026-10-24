import type {MemoryVerdict, SoakVerdict} from './judge.mts';
import type {RecordProblem} from './record.mts';

const MS_PER_MINUTE = 60_000;
const KB_PER_MB = 1024;
const MAX_PROBLEMS_SHOWN = 10;
const TREND_COLUMN_WIDTH = 'unjudged'.length;

function minutes(milliseconds: number): string {
  return `${(milliseconds / MS_PER_MINUTE).toFixed(1)} min`;
}

function megabytes(kilobytes: number): string {
  return `${(kilobytes / KB_PER_MB).toFixed(1)} MB`;
}

function rate(kilobytesPerHour: number): string {
  const sign = kilobytesPerHour < 0 ? '-' : '+';
  return `${sign}${megabytes(Math.abs(kilobytesPerHour))}/h`;
}

function memoryDetail(verdict: MemoryVerdict): string {
  if (verdict.growthKbPerHour === null) return 'too few samples';
  const baselines = verdict.baselinesKb.map(megabytes).join(', ');
  return `${rate(verdict.growthKbPerHour)} (${baselines})`;
}

function memoryLine(verdict: MemoryVerdict): string {
  return `  ${verdict.trend.padEnd(TREND_COLUMN_WIDTH)}  ${verdict.name}: ${memoryDetail(verdict)}`;
}

function problemLines(problems: readonly RecordProblem[]): string[] {
  if (problems.length === 0) return [];
  const shown = problems
    .slice(0, MAX_PROBLEMS_SHOWN)
    .map(p => `  line ${p.line}: ${p.reason}`);
  const hidden = problems.length - shown.length;
  return [
    `Dropped record lines (${problems.length}):`,
    ...shown,
    ...(hidden > 0 ? [`  ... and ${hidden} more`] : []),
  ];
}

/** Renders the soak verdict as the text the runner prints. */
export function formatReport(
  verdict: SoakVerdict,
  problems: readonly RecordProblem[],
): string {
  const lines = [
    `Record covers ${minutes(verdict.coveredMs)}${verdict.longEnough ? '' : ' (too short)'}.`,
    'Memory (rise per hour, then the lowest private memory per window):',
    ...verdict.memory.map(memoryLine),
    ...verdict.relaunches.map(
      r => `Relaunched: ${r.name} came back ${r.count} times.`,
    ),
    ...verdict.fps.map(
      f =>
        `${f.belowTarget ? 'Warning: ' : ''}fps ${f.screen}: median ${f.medianFps.toFixed(1)}, lowest ${f.lowestFps.toFixed(1)}`,
    ),
    ...problemLines(problems),
    verdict.passed ? 'Soak test passed.' : 'Soak test failed.',
  ];
  return lines.join('\n');
}
