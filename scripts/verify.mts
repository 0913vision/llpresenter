import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {stripVTControlCharacters} from 'node:util';
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
  /** The lines that say what failed, for a step that failed. */
  readonly failureLines: readonly string[];
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
) => Promise<StepOutcome>;

const MS_PER_SECOND = 1000;
const FAILURE_EXIT_CODE = 1;
const MAX_FAILURE_LINES = 20;
const MAX_KEPT_OUTPUT_CHARS = 2_000_000;
const LOOKAHEAD_LINES = 6;
const NOTABLE_LINE =
  /^\s*(?:FAIL\s|×\s|Error: \[vitest-pool|Vitest caught \d+ unhandled)|Unhandled (?:Errors?|Rejection)/;
const ERROR_MESSAGE = /^\s*[A-Za-z]*(?:Error|Exception)\b[^:]*:/;
const SEPARATOR = /⎯+/g;

/** Runs the steps in order and stops at the first one that fails. */
export async function runSteps(
  steps: readonly VerifyStep[],
  runStep: StepRunner,
): Promise<VerifyResult> {
  const passed: PassedStep[] = [];
  for (const [index, step] of steps.entries()) {
    const outcome = await runStep(step, {
      number: index + 1,
      total: steps.length,
    });
    if (outcome.exitCode !== 0) return {passed, failed: {step, outcome}};
    passed.push({step, milliseconds: outcome.milliseconds});
  }
  return {passed, failed: null};
}

function cleanLine(line: string): string {
  return line.replace(SEPARATOR, '').trim();
}

interface Failure {
  readonly line: string;
  readonly error: string | null;
}

// NOTE(0913vision): Vitest prints tests that failed the same way as
// consecutive FAIL lines followed by one error, so the error belongs to the
// whole group of notable lines before it.
function groupFailures(lines: readonly string[]): Failure[] {
  const failures: Failure[] = [];
  let group: string[] = [];
  let linesAfterGroup = 0;
  const closeGroup = (error: string | null): void => {
    for (const line of group) failures.push({line, error});
    group = [];
    linesAfterGroup = 0;
  };
  for (const line of lines) {
    if (NOTABLE_LINE.test(line)) {
      if (linesAfterGroup > 0) closeGroup(null);
      group.push(cleanLine(line));
    } else if (group.length > 0) {
      linesAfterGroup += 1;
      if (ERROR_MESSAGE.test(line)) closeGroup(cleanLine(line));
      else if (linesAfterGroup >= LOOKAHEAD_LINES) closeGroup(null);
    }
  }
  closeGroup(null);
  return failures;
}

function distinctFailures(failures: readonly Failure[]): Failure[] {
  const withError = new Set(
    failures.filter(f => f.error !== null).map(f => f.line),
  );
  const seen = new Set<string>();
  return failures.filter(failure => {
    if (failure.error === null && withError.has(failure.line)) return false;
    const key = JSON.stringify([failure.line, failure.error]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Picks the lines that name what failed from a step's output: Vitest's
 * `FAIL` and `×` lines, worker start errors, and the unhandled error and
 * rejection blocks, each with the first error line that follows it (for
 * example "Error: Test timed out in 60000ms."). Without them, a timeout on a
 * busy machine looks the same as a broken test.
 */
export function failureLines(output: string): string[] {
  const lines = stripVTControlCharacters(output).split(/\r?\n/);
  return distinctFailures(groupFailures(lines))
    .slice(0, MAX_FAILURE_LINES)
    .map(({line, error}) => (error === null ? line : `${line} (${error})`));
}

/**
 * Hands a stream's text to `onText` as it arrives. One UTF-8 decoder per
 * stream keeps a character that is split across two chunks (such as `×`)
 * whole.
 */
export function readText(
  stream: NodeJS.ReadableStream,
  onText: (text: string) => void,
): void {
  stream.setEncoding('utf8');
  stream.on('data', (text: string) => onText(text));
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
  );
  if (outcome.failureLines.length > 0) {
    lines.push('What failed:', ...outcome.failureLines.map(l => `  ${l}`));
  }
  lines.push(
    `Fix it, then run "npm run ${step}" alone or "npm run verify" again.`,
  );
  return lines.join('\n');
}

function keepTail(text: string): string {
  return text.length > MAX_KEPT_OUTPUT_CHARS
    ? text.slice(-MAX_KEPT_OUTPUT_CHARS)
    : text;
}

function stepEnvironment(): NodeJS.ProcessEnv {
  const color = process.stdout.isTTY ? {FORCE_COLOR: '1'} : {};
  return {...process.env, ...color, NODE_COMPILE_CACHE: COMPILE_CACHE_DIR};
}

function npmRunner(npmCli: string): StepRunner {
  return (step, position) =>
    new Promise(resolve => {
      console.log(`\n${formatHeader(step, position)}`);
      const start = performance.now();
      let output = '';
      const child = spawn(process.execPath, [npmCli, 'run', step], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: stepEnvironment(),
      });
      // NOTE(0913vision): The output goes straight to the terminal and is
      // also kept, capped, so the summary can name what failed. FORCE_COLOR
      // keeps the tools' colors, which they drop when they see a pipe.
      readText(child.stdout, text => {
        process.stdout.write(text);
        output = keepTail(output + text);
      });
      readText(child.stderr, text => {
        process.stderr.write(text);
        output = keepTail(output + text);
      });
      const finish = (exitCode: number | null, signal: string | null): void => {
        resolve({
          exitCode,
          signal,
          milliseconds: performance.now() - start,
          failureLines: exitCode === 0 ? [] : failureLines(output),
        });
      };
      child.once('error', error => {
        console.error(`Could not start "npm run ${step}": ${error.message}`);
        finish(FAILURE_EXIT_CODE, null);
      });
      child.once('close', (code, signal) => finish(code, signal));
    });
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
  const result = await runSteps(VERIFY_STEPS, npmRunner(npmCli));
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
  main().catch((error: unknown) => {
    console.error('verify failed to run:', error);
    process.exitCode = FAILURE_EXIT_CODE;
  });
}
