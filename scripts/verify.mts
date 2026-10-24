import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {COMPILE_CACHE_DIR} from './compile-cache.mts';

/** The npm scripts that `npm run verify` runs, in order. */
export const VERIFY_STEPS = [
  'typecheck',
  'lint',
  'format:check',
  'test:coverage',
  'build',
] as const;

/** One npm script that verify runs. */
export type VerifyStep = (typeof VERIFY_STEPS)[number];

/** How one step ended: its exit code, or the signal that stopped it. */
export interface StepOutcome {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly milliseconds: number;
}

/** Where a step sits in the run, counted from 1. */
export interface StepPosition {
  readonly number: number;
  readonly total: number;
}

/** A step that passed and how long it took. */
export interface PassedStep {
  readonly step: VerifyStep;
  readonly milliseconds: number;
}

/** A step that failed and how it ended. */
export interface FailedStep {
  readonly step: VerifyStep;
  readonly outcome: StepOutcome;
}

/** The result of a verify run: the steps that passed, then the one that failed. */
export interface VerifyResult {
  readonly passed: readonly PassedStep[];
  readonly failed: FailedStep | null;
}

/** Runs one step and reports how it ended. */
export type StepRunner = (
  step: VerifyStep,
  position: StepPosition,
) => StepOutcome;

const MS_PER_SECOND = 1000;
const FAILURE_EXIT_CODE = 1;

/** Runs the steps in order and stops at the first one that fails. */
export function runSteps(
  steps: readonly VerifyStep[],
  runStep: StepRunner,
): VerifyResult {
  const passed: PassedStep[] = [];
  for (const [index, step] of steps.entries()) {
    const outcome = runStep(step, {number: index + 1, total: steps.length});
    if (outcome.exitCode !== 0) return {passed, failed: {step, outcome}};
    passed.push({step, milliseconds: outcome.milliseconds});
  }
  return {passed, failed: null};
}

function seconds(milliseconds: number): string {
  return `${(milliseconds / MS_PER_SECOND).toFixed(1)} s`;
}

function howItEnded(outcome: StepOutcome): string {
  if (outcome.signal !== null) return `was stopped by ${outcome.signal}`;
  return `exited with code ${outcome.exitCode ?? 'unknown'}`;
}

/** Renders the line printed before a step starts. */
export function formatHeader(step: VerifyStep, position: StepPosition): string {
  return `[verify ${position.number}/${position.total}] npm run ${step}`;
}

/** Renders the closing lines that say what passed and where verify stopped. */
export function formatSummary(
  result: VerifyResult,
  totalSteps: number,
): string {
  const lines = result.passed.map(
    ({step, milliseconds}) => `  ok    ${step} (${seconds(milliseconds)})`,
  );
  if (result.failed === null) {
    const total = result.passed.reduce((sum, p) => sum + p.milliseconds, 0);
    lines.push(`verify passed: ${totalSteps} steps in ${seconds(total)}.`);
    return lines.join('\n');
  }
  const {step, outcome} = result.failed;
  lines.push(
    `  FAIL  ${step} (${seconds(outcome.milliseconds)})`,
    `verify failed at step ${result.passed.length + 1}/${totalSteps}: "npm run ${step}" ${howItEnded(outcome)}.`,
    `Fix it, then run "npm run ${step}" alone or "npm run verify" again.`,
  );
  return lines.join('\n');
}

function npmRunner(npmCli: string): StepRunner {
  return (step, position) => {
    console.log(`\n${formatHeader(step, position)}`);
    const start = performance.now();
    const child = spawnSync(process.execPath, [npmCli, 'run', step], {
      stdio: 'inherit',
      env: {...process.env, NODE_COMPILE_CACHE: COMPILE_CACHE_DIR},
    });
    if (child.error !== undefined) {
      console.error(
        `Could not start "npm run ${step}": ${child.error.message}`,
      );
    }
    return {
      exitCode: child.error === undefined ? child.status : FAILURE_EXIT_CODE,
      signal: child.signal,
      milliseconds: performance.now() - start,
    };
  };
}

function main(): void {
  // NOTE(0913vision): npm sets npm_execpath to its own CLI script. Running it
  // with this Node avoids spawning npm.cmd through a shell on Windows, so Git
  // Bash and PowerShell behave the same.
  const npmCli = process.env['npm_execpath'];
  if (npmCli === undefined) {
    console.error('Run this through "npm run verify".');
    process.exitCode = FAILURE_EXIT_CODE;
    return;
  }
  const result = runSteps(VERIFY_STEPS, npmRunner(npmCli));
  const summary = formatSummary(result, VERIFY_STEPS.length);
  if (result.failed === null) {
    console.log(`\n${summary}`);
    return;
  }
  console.error(`\n${summary}`);
  process.exitCode = result.failed.outcome.exitCode ?? FAILURE_EXIT_CODE;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main();
}
