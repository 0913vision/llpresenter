import {spawn, type ChildProcessByStdio} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import type {Readable} from 'node:stream';
import {killProcessTree} from '../process-tree.mts';
import {FailureScanner} from './failure-scanner.mts';
import {readText, TailBuffer} from './step-output.mts';

/** Why verify stopped a step before it ended on its own. */
export type StopReason = 'deadline' | 'interrupt';

/** How one step ended, what it printed, and what failed in it. */
export interface StepOutcome {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stoppedBy: StopReason | null;
  readonly milliseconds: number;
  /** The end of what the step printed, at most two million characters. */
  readonly output: string;
  /** The lines that name what failed, found in all of the output. */
  readonly failureLines: readonly string[];
}

/** What to start for one step, and when to stop it. */
export interface StepCommand {
  /** How messages name the step, such as `npm run lint`. */
  readonly name: string;
  readonly file: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly deadlineMs: number;
  readonly interrupt: AbortSignal;
}

const FAILURE_EXIT_CODE = 1;
const MAX_KEPT_OUTPUT_CHARS = 2_000_000;
const MS_PER_SECOND = 1000;
// NOTE(0913vision): A process that survives taskkill can keep the step's pipes
// open. After this long, verify lets go of them, so it always ends.
const CLOSE_GRACE_MS = 5000;

type StepChild = ChildProcessByStdio<null, Readable, Readable>;

function stopNotice(
  name: string,
  reason: StopReason,
  deadlineMs: number,
): string {
  switch (reason) {
    case 'deadline':
      return `[verify stopped ${name} after ${deadlineMs / MS_PER_SECOND} s]`;
    case 'interrupt':
      return `[verify was interrupted and stopped ${name}]`;
    default: {
      const unknownReason: never = reason;
      return `[verify stopped ${name}: ${String(unknownReason)}]`;
    }
  }
}

// NOTE(0913vision): Node runs this file by stripping the types, which can't
// handle parameter properties, so the constructor assigns its fields.
class StepProcess {
  private readonly command: StepCommand;
  private readonly child: StepChild;
  private readonly resolve: (outcome: StepOutcome) => void;
  private readonly started = performance.now();
  private readonly output = new TailBuffer(MAX_KEPT_OUTPUT_CHARS);
  private readonly failures = new FailureScanner();
  private readonly onInterrupt = (): void => this.stop('interrupt');
  private deadline: NodeJS.Timeout | null = null;
  private closeGrace: NodeJS.Timeout | null = null;
  private stoppedBy: StopReason | null = null;
  private settled = false;

  constructor(
    command: StepCommand,
    child: StepChild,
    resolve: (outcome: StepOutcome) => void,
  ) {
    this.command = command;
    this.child = child;
    this.resolve = resolve;
  }

  watch(): void {
    const {child, command} = this;
    readText(child.stdout, text => this.keep(text));
    readText(child.stderr, text => this.keep(text));
    child.once('error', error => this.failToStart(error));
    child.once('close', (code, signal) => this.settle(code, signal));
    this.deadline = setTimeout(() => this.stop('deadline'), command.deadlineMs);
    command.interrupt.addEventListener('abort', this.onInterrupt);
    if (command.interrupt.aborted) this.stop('interrupt');
  }

  private keep(text: string): void {
    this.output.push(text);
    this.failures.push(text);
  }

  private failToStart(error: Error): void {
    this.keep(
      `[verify could not start ${this.command.name}: ${error.message}]\n`,
    );
    this.settle(FAILURE_EXIT_CODE, null);
  }

  private stop(reason: StopReason): void {
    if (this.settled || this.stoppedBy !== null) return;
    this.stoppedBy = reason;
    const {name, deadlineMs} = this.command;
    this.keep(`\n${stopNotice(name, reason, deadlineMs)}\n`);
    this.killTree().catch((error: unknown) => {
      this.keep(`[verify could not stop ${name}: ${String(error)}]\n`);
    });
  }

  private async killTree(): Promise<void> {
    const {pid} = this.child;
    if (pid !== undefined) {
      const result = await killProcessTree(pid);
      if (!result.ok) {
        this.keep(
          `[verify could not stop all of ${this.command.name}: ${result.reason}]\n`,
        );
      }
    }
    if (this.settled) return;
    this.closeGrace = setTimeout(() => this.release(), CLOSE_GRACE_MS);
  }

  private release(): void {
    this.child.stdout.destroy();
    this.child.stderr.destroy();
    this.child.unref();
    this.settle(FAILURE_EXIT_CODE, null);
  }

  private settle(exitCode: number | null, signal: string | null): void {
    if (this.settled) return;
    this.settled = true;
    if (this.deadline !== null) clearTimeout(this.deadline);
    if (this.closeGrace !== null) clearTimeout(this.closeGrace);
    this.command.interrupt.removeEventListener('abort', this.onInterrupt);
    this.resolve({
      exitCode,
      signal,
      stoppedBy: this.stoppedBy,
      milliseconds: performance.now() - this.started,
      output: this.output.text(),
      failureLines: this.failures.finish(),
    });
  }
}

/**
 * Runs one step's process to the end and reports how it ended. A step that
 * runs past `deadlineMs`, or that is still running when `interrupt` aborts,
 * is stopped together with every process it started.
 */
export function runStepProcess(command: StepCommand): Promise<StepOutcome> {
  return new Promise(resolve => {
    const child = spawn(command.file, [...command.args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: command.env,
      windowsHide: true,
    });
    new StepProcess(command, child, resolve).watch();
  });
}
