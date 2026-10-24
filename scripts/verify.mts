import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {COMPILE_CACHE_DIR} from './compile-cache.mts';
import {
  runStepProcess,
  type StepCommand,
  type StepOutcome,
} from './verify/step-process.mts';

/** The npm scripts that `npm run verify` runs, in the order it reports them. */
export const VERIFY_STEPS = [
  'typecheck',
  'lint',
  'format:check',
  'test:coverage',
  'build',
] as const;

/** One npm script that verify runs. */
export type VerifyStep = (typeof VERIFY_STEPS)[number];

/** One step and how it ended. */
export interface StepResult {
  readonly step: VerifyStep;
  readonly outcome: StepOutcome;
}

/** Every step's result in step order, and the first one that failed. */
export interface VerifyResult {
  readonly results: readonly StepResult[];
  readonly failed: StepResult | null;
}

/** Runs one step to the end and reports how it ended. */
export type StepRunner = (step: VerifyStep) => Promise<StepOutcome>;

/** What one verify run needs from the outside. */
export interface VerifyRun {
  /** npm's own CLI script, which runs each step with this Node. */
  readonly npmCli: string;
  readonly steps: readonly VerifyStep[];
  readonly stepDeadlineMs: number;
  readonly interrupt: AbortSignal;
  readonly console: Pick<Console, 'log' | 'error'>;
}

const MS_PER_SECOND = 1000;
const FAILURE_EXIT_CODE = 1;
// NOTE(0913vision): The slowest step, test:coverage, took up to 4 minutes on
// a machine busy with several sessions. Ten minutes ends a hung step without
// failing a slow one.
const STEP_DEADLINE_MS = 10 * 60 * MS_PER_SECOND;
const INTERRUPT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const;

function passed(outcome: StepOutcome): boolean {
  return outcome.exitCode === 0 && outcome.stoppedBy === null;
}

/**
 * Starts every step at once and waits for all of them. The steps don't depend
 * on each other's files, so the run takes about as long as the slowest step.
 * The first failure in step order decides the result.
 */
export async function runSteps(
  steps: readonly VerifyStep[],
  runStep: StepRunner,
): Promise<VerifyResult> {
  const outcomes = await Promise.all(steps.map(step => runStep(step)));
  const results = steps.map((step, index): StepResult => {
    const outcome = outcomes[index];
    if (outcome === undefined) throw new Error(`no outcome for ${step}`);
    return {step, outcome};
  });
  return {results, failed: results.find(r => !passed(r.outcome)) ?? null};
}

function seconds(milliseconds: number): string {
  return `${(milliseconds / MS_PER_SECOND).toFixed(1)} s`;
}

function howItEnded(outcome: StepOutcome): string {
  switch (outcome.stoppedBy) {
    case 'deadline':
      return `ran too long and was stopped after ${seconds(outcome.milliseconds)}`;
    case 'interrupt':
      return 'was stopped because verify was interrupted';
    case null:
      break;
    default: {
      const unknownReason: never = outcome.stoppedBy;
      return `was stopped: ${String(unknownReason)}`;
    }
  }
  if (outcome.signal !== null) return `was stopped by ${outcome.signal}`;
  return `exited with code ${outcome.exitCode ?? 'unknown'}`;
}

function statusLine({step, outcome}: StepResult): string {
  const status = passed(outcome) ? 'ok  ' : 'FAIL';
  return `  ${status}  ${step} (${seconds(outcome.milliseconds)})`;
}

/**
 * Renders what verify prints when one step finishes: a status line, and for a
 * failed step everything it printed.
 */
export function formatStepReport(result: StepResult): string {
  const line = statusLine(result);
  if (passed(result.outcome)) return line;
  const output = result.outcome.output.trimEnd();
  return `${line}\n\n--- npm run ${result.step} ---\n${output}\n--- end of npm run ${result.step} ---\n`;
}

/**
 * Renders the closing lines: each step in order, then the verdict, with the
 * lines that name what failed in the first failed step.
 */
export function formatSummary(
  result: VerifyResult,
  wallMilliseconds: number,
): string {
  const lines = result.results.map(statusLine);
  if (result.failed === null) {
    lines.push(
      `verify passed: ${result.results.length} steps in ${seconds(wallMilliseconds)}.`,
    );
    return lines.join('\n');
  }
  const {step, outcome} = result.failed;
  lines.push(
    `verify failed: "npm run ${step}" ${howItEnded(outcome)}. Its output is above.`,
  );
  if (outcome.failureLines.length > 0) {
    lines.push('What failed:', ...outcome.failureLines.map(l => `  ${l}`));
  }
  lines.push(
    `Fix it, then run "npm run ${step}" alone or "npm run verify" again.`,
  );
  return lines.join('\n');
}

/** Picks verify's exit code: 0 when every step passed, never 0 otherwise. */
export function exitCodeFor(result: VerifyResult): number {
  if (result.failed === null) return 0;
  const {exitCode} = result.failed.outcome;
  return exitCode === null || exitCode === 0 ? FAILURE_EXIT_CODE : exitCode;
}

function stepEnvironment(): NodeJS.ProcessEnv {
  // NOTE(0913vision): Output is captured to keep the steps apart, so the tools
  // see no terminal. FORCE_COLOR keeps their colors when verify itself runs in
  // one.
  const color = process.stdout.isTTY ? {FORCE_COLOR: '1'} : {};
  return {...process.env, ...color, NODE_COMPILE_CACHE: COMPILE_CACHE_DIR};
}

function npmCommand(run: VerifyRun, step: VerifyStep): StepCommand {
  return {
    name: `npm run ${step}`,
    file: process.execPath,
    args: [run.npmCli, 'run', step],
    env: stepEnvironment(),
    deadlineMs: run.stepDeadlineMs,
    interrupt: run.interrupt,
  };
}

/**
 * Runs the steps at once, prints each step's report as it finishes and the
 * summary at the end, and returns verify's exit code.
 */
export async function verify(run: VerifyRun): Promise<number> {
  run.console.log(`[verify] running ${run.steps.join(', ')} at once`);
  const start = performance.now();
  const result = await runSteps(run.steps, async step => {
    const outcome = await runStepProcess(npmCommand(run, step));
    run.console.log(formatStepReport({step, outcome}));
    return outcome;
  });
  const summary = formatSummary(result, performance.now() - start);
  if (result.failed === null) run.console.log(`\n${summary}`);
  else run.console.error(`\n${summary}`);
  return exitCodeFor(result);
}

async function main(): Promise<void> {
  // NOTE(0913vision): npm sets npm_execpath to its own CLI script. Running it
  // with this Node avoids spawning npm.cmd through a shell on Windows, so Git
  // Bash and PowerShell behave the same.
  const npmCli = process.env['npm_execpath'];
  if (npmCli === undefined) {
    console.error('Run this through "npm run verify".');
    process.exitCode = FAILURE_EXIT_CODE;
    return;
  }
  const interruption = new AbortController();
  const interrupt = (): void => interruption.abort();
  for (const signal of INTERRUPT_SIGNALS) process.on(signal, interrupt);
  try {
    process.exitCode = await verify({
      npmCli,
      steps: VERIFY_STEPS,
      stepDeadlineMs: STEP_DEADLINE_MS,
      interrupt: interruption.signal,
      console,
    });
  } finally {
    for (const signal of INTERRUPT_SIGNALS) process.off(signal, interrupt);
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error('verify failed to run:', error);
    process.exitCode = FAILURE_EXIT_CODE;
  });
}
