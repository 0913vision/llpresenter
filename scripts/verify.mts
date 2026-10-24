import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {stripVTControlCharacters} from 'node:util';
import {COMPILE_CACHE_DIR} from './compile-cache.mts';

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

/** How one step ended: its exit code or the signal that stopped it, and what it printed. */
export interface StepOutcome {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly milliseconds: number;
  readonly output: string;
}

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

const MS_PER_SECOND = 1000;
const FAILURE_EXIT_CODE = 1;
const MAX_FAILURE_LINES = 20;
const MAX_KEPT_OUTPUT_CHARS = 2_000_000;
const LOOKAHEAD_LINES = 6;
const NOTABLE_LINE =
  /^\s*(?:FAIL\s|×\s|Error: \[vitest-pool|Vitest caught \d+ unhandled)|Unhandled (?:Errors?|Rejection)/;
const ERROR_MESSAGE = /^\s*[A-Za-z]*(?:Error|Exception)\b[^:]*:/;
const SEPARATOR = /⎯+/g;

function passed(outcome: StepOutcome): boolean {
  return outcome.exitCode === 0;
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
  const failed = failureLines(outcome.output);
  if (failed.length > 0) {
    lines.push('What failed:', ...failed.map(line => `  ${line}`));
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
  // NOTE(0913vision): Output is captured to keep the steps apart, so the tools
  // see no terminal. FORCE_COLOR keeps their colors when verify itself runs in
  // one.
  const color = process.stdout.isTTY ? {FORCE_COLOR: '1'} : {};
  return {...process.env, ...color, NODE_COMPILE_CACHE: COMPILE_CACHE_DIR};
}

function npmRunner(npmCli: string): StepRunner {
  return step =>
    new Promise(resolve => {
      const start = performance.now();
      let output = '';
      const keep = (text: string): void => {
        output = keepTail(output + text);
      };
      const child = spawn(process.execPath, [npmCli, 'run', step], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: stepEnvironment(),
      });
      readText(child.stdout, keep);
      readText(child.stderr, keep);
      const finish = (exitCode: number | null, signal: string | null): void => {
        const outcome = {
          exitCode,
          signal,
          milliseconds: performance.now() - start,
          output,
        };
        console.log(formatStepReport({step, outcome}));
        resolve(outcome);
      };
      child.once('error', error => {
        keep(`Could not start "npm run ${step}": ${error.message}\n`);
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
  console.log(`[verify] running ${VERIFY_STEPS.join(', ')} at once`);
  const start = performance.now();
  const result = await runSteps(VERIFY_STEPS, npmRunner(npmCli));
  const summary = formatSummary(result, performance.now() - start);
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
