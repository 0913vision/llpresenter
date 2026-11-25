import {spawn, type ChildProcess} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {
  PowerPointProcesses,
  StartedPowerPointStore,
} from './powerpointProcess';

/**
 * How a PowerPoint run ended: finished, cancelled, PowerPoint is not usable,
 * PowerPoint stopped answering or took too long, or a file problem.
 */
export type PowerPointImagesResult =
  'ok' | 'cancelled' | 'unavailable' | 'unresponsive' | 'file';

/** How long a run may take before it is stopped. */
export const RUN_TIMEOUT_MS = 120_000;
/** How long a run that was asked to stop gets before it is ended. */
export const STOP_GRACE_MS = 5000;
/** How long the PowerPoint a run started gets to quit on its own. */
export const QUIT_GRACE_MS = 3000;
const CLEANUP_LIMIT_MS = 5000;
const POLL_MS = 250;

/** What one run needs: its scripts, its folder and values, and the processes. */
export interface PowerPointRunOptions {
  readonly script: string;
  /** Restores a PowerPoint the run did not start, after the run was ended. */
  readonly cleanupScript: string;
  readonly directory: string;
  /** The `LLP_PPT_*` values the scripts read. */
  readonly env: Readonly<Record<string, string>>;
  readonly progress: (done: number, total: number, number: number) => void;
  readonly processes: PowerPointProcesses;
  readonly started: StartedPowerPointStore;
  readonly timeoutMs?: number;
}

/**
 * The PowerShell arguments that run a script given as UTF-16 Base64, so no
 * value ever reaches the command line; the script reads them from its
 * environment.
 */
export function encodedScriptArguments(script: string): string[] {
  return [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64'),
  ];
}

/** What one line the script prints says, or null for any other line. */
export function scriptLine(line: string):
  | {readonly kind: 'failure'; readonly failure: PowerPointImagesResult}
  | {readonly kind: 'started'; readonly pid: number}
  | {
      readonly kind: 'progress';
      readonly done: number;
      readonly total: number;
      readonly number: number;
    }
  | null {
  if (line === 'FAILURE unavailable') {
    return {kind: 'failure', failure: 'unavailable'};
  }
  if (line === 'FAILURE unresponsive') {
    return {kind: 'failure', failure: 'unresponsive'};
  }
  const started = /^STARTED (\d+)$/.exec(line);
  if (started) return {kind: 'started', pid: Number(started[1])};
  const match = /^PROGRESS (\d+) (\d+) (\d+)$/.exec(line);
  return match
    ? {
        kind: 'progress',
        done: Number(match[1]),
        total: Number(match[2]),
        number: Number(match[3]),
      }
    : null;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * One use of PowerPoint by a script, which owns everything the use makes: the
 * PowerShell process, the PowerPoint process the script started, and the
 * timers. Disposing it, which `await using` does on every path, stops the
 * script, ends that PowerPoint if it has not quit, or puts back a PowerPoint
 * the operator had open, and forgets the started process.
 */
export class PowerPointRun implements AsyncDisposable {
  /** How the script ended. */
  readonly result: Promise<PowerPointImagesResult>;
  private readonly child: ChildProcess;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private startedPid: number | null = null;
  private exited = false;
  private cancelled = false;
  private timedOut = false;
  private forced = false;
  private released: Promise<void> | null = null;

  constructor(private readonly options: PowerPointRunOptions) {
    this.child = spawn(
      'powershell.exe',
      encodedScriptArguments(options.script),
      {
        windowsHide: true,
        env: {...process.env, ...options.env},
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    this.result = this.follow();
    this.after((options.timeoutMs ?? RUN_TIMEOUT_MS) - STOP_GRACE_MS, () => {
      this.timedOut = true;
      this.cancel();
    });
  }

  /** The PowerPoint process the script started, if it started one. */
  get started(): number | null {
    return this.startedPid;
  }

  /** Asks the script to stop at its next slide, and ends it if it has not. */
  cancel(): void {
    if (this.exited) return;
    this.cancelled = true;
    try {
      writeFileSync(join(this.options.directory, 'cancel'), '');
      this.after(STOP_GRACE_MS, () => this.force());
    } catch {
      this.force();
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.released ??= this.release();
    await this.released;
  }

  private follow(): Promise<PowerPointImagesResult> {
    return new Promise(resolve => {
      let failure: PowerPointImagesResult = 'file';
      let output = '';
      const finish = (result: PowerPointImagesResult): void => {
        if (this.exited) return;
        this.exited = true;
        resolve(
          this.timedOut || this.forced
            ? 'unresponsive'
            : this.cancelled
              ? 'cancelled'
              : result,
        );
      };
      this.child.stdout?.setEncoding('utf8');
      this.child.stdout?.on('data', (chunk: string) => {
        output += chunk;
        const lines = output.split(/\r?\n/);
        output = lines.pop() ?? '';
        for (const line of lines) this.read(line, value => (failure = value));
      });
      this.child.once('error', () => finish('unresponsive'));
      this.child.once('close', code => finish(code === 0 ? 'ok' : failure));
    });
  }

  private read(
    line: string,
    onFailure: (failure: PowerPointImagesResult) => void,
  ): void {
    const read = scriptLine(line);
    if (read?.kind === 'failure') onFailure(read.failure);
    if (read?.kind === 'progress') {
      this.options.progress(read.done, read.total, read.number);
    }
    if (read?.kind === 'started') {
      this.startedPid = read.pid;
      this.options.started.write(read.pid);
    }
  }

  /** Whether the script has ended; it can end while the run waits. */
  private hasExited(): boolean {
    return this.exited;
  }

  private force(): void {
    if (this.exited || this.forced) return;
    this.forced = true;
    this.child.kill();
  }

  private after(ms: number, run: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      run();
    }, ms);
    this.timers.add(timer);
  }

  private async release(): Promise<void> {
    if (!this.exited) {
      this.cancel();
      // NOTE(0913vision): A killed process that never reports its end must
      // not hold the release; what it held is ended below all the same.
      await Promise.race([this.result, sleep(STOP_GRACE_MS + 2000)]);
      if (!this.hasExited()) this.child.kill();
    }
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.startedPid !== null) await this.endStarted(this.startedPid);
    else if (this.forced) await this.restoreAttached();
  }

  /**
   * Gives the PowerPoint the script started time to quit, then ends it. One
   * that shows a window is left: the operator opened a presentation in it.
   */
  private async endStarted(pid: number): Promise<void> {
    const {processes, started} = this.options;
    for (let waited = 0; waited < QUIT_GRACE_MS && isRunning(pid);) {
      await sleep(POLL_MS);
      waited += POLL_MS;
    }
    const state = await processes.inspect(pid);
    if (!state.alive || state.windowed || (await processes.end(pid))) {
      started.write(null);
    }
  }

  /** Closes the run's presentation in the operator's PowerPoint and puts its settings back. */
  private async restoreAttached(): Promise<void> {
    const helper = spawn(
      'powershell.exe',
      encodedScriptArguments(this.options.cleanupScript),
      {
        windowsHide: true,
        env: {...process.env, ...this.options.env},
        stdio: ['ignore', 'ignore', 'ignore'],
      },
    );
    await new Promise<void>(resolve => {
      const limit = setTimeout(() => {
        helper.kill();
        resolve();
      }, CLEANUP_LIMIT_MS);
      const done = (): void => {
        clearTimeout(limit);
        resolve();
      };
      helper.once('error', done);
      helper.once('close', done);
    });
  }
}
