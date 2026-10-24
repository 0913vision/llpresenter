import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {isRunning, waitForHungTree, writeHungTree} from '../test/process-trees';
import {makeTempDir} from '../test/temp-dir';
import {
  exitCodeFor,
  formatStepReport,
  formatSummary,
  runSteps,
  verify,
  type VerifyRun,
  type VerifyStep,
} from './verify.mts';
import type {StepOutcome} from './verify/step-process.mts';

function outcome(
  exitCode: number | null,
  extra: Partial<StepOutcome> = {},
): StepOutcome {
  return {
    exitCode,
    signal: null,
    stoppedBy: null,
    leftRunning: false,
    milliseconds: 1500,
    output: '',
    failureLines: [],
    ...extra,
  };
}

function later<T>(value: T, ticks: number): Promise<T> {
  return new Promise(resolve => {
    let left = ticks;
    const tick = (): void => {
      if (left === 0) {
        resolve(value);
        return;
      }
      left -= 1;
      queueMicrotask(tick);
    };
    tick();
  });
}

describe('runSteps', () => {
  it('starts every step before any of them finishes', async () => {
    const started: VerifyStep[] = [];
    let finishedSteps = 0;
    await runSteps(['typecheck', 'lint', 'build'], async step => {
      started.push(step);
      expect(finishedSteps).toBe(0);
      const result = await later(outcome(0), 3);
      finishedSteps += 1;
      return result;
    });
    expect(started).toEqual(['typecheck', 'lint', 'build']);
  });

  it('reports the steps in step order, whatever order they finish in', async () => {
    const result = await runSteps(['typecheck', 'lint', 'build'], step =>
      later(outcome(0), step === 'typecheck' ? 5 : 1),
    );
    expect(result.results.map(r => r.step)).toEqual([
      'typecheck',
      'lint',
      'build',
    ]);
    expect(result.failed).toBeNull();
  });

  it('picks the first failure in step order, not the first to finish', async () => {
    const result = await runSteps(['typecheck', 'lint', 'build'], step => {
      if (step === 'lint') return later(outcome(1), 5);
      if (step === 'build') return later(outcome(2), 1);
      return later(outcome(0), 1);
    });
    expect(result.failed?.step).toBe('lint');
    expect(result.failed?.outcome.exitCode).toBe(1);
  });

  it('treats a step without an exit code as failed', async () => {
    const result = await runSteps(['test:coverage'], () =>
      later(outcome(null, {signal: 'SIGTERM'}), 1),
    );
    expect(result.failed?.step).toBe('test:coverage');
  });
});

describe('formatStepReport', () => {
  it('prints one line for a step that passed', () => {
    expect(
      formatStepReport({step: 'lint', outcome: outcome(0, {output: 'noise'})}),
    ).toBe('  ok    lint (1.5 s)');
  });

  it('prints everything a failed step printed, between markers', () => {
    const report = formatStepReport({
      step: 'lint',
      outcome: outcome(1, {output: 'src/a.ts\n  1:1  error  bad\n\n'}),
    });
    expect(report).toBe(
      [
        '  FAIL  lint (1.5 s)',
        '',
        '--- npm run lint ---',
        'src/a.ts',
        '  1:1  error  bad',
        '--- end of npm run lint ---',
        '',
      ].join('\n'),
    );
  });
});

describe('formatSummary', () => {
  it('lists each step and the wall time when all pass', () => {
    const summary = formatSummary(
      {
        results: [
          {step: 'typecheck', outcome: outcome(0)},
          {step: 'lint', outcome: outcome(0, {milliseconds: 2500})},
        ],
        failed: null,
      },
      2600,
    );
    expect(summary).toBe(
      [
        '  ok    typecheck (1.5 s)',
        '  ok    lint (2.5 s)',
        'verify passed: 2 steps in 2.6 s.',
      ].join('\n'),
    );
  });

  it('names the failed step, its exit code, and what to run next', () => {
    const lint = {step: 'lint', outcome: outcome(1)} as const;
    const summary = formatSummary(
      {results: [{step: 'typecheck', outcome: outcome(0)}, lint], failed: lint},
      3000,
    );
    expect(summary).toBe(
      [
        '  ok    typecheck (1.5 s)',
        '  FAIL  lint (1.5 s)',
        'verify failed: "npm run lint" exited with code 1. Its output is above.',
        'Fix it, then run "npm run lint" alone or "npm run verify" again.',
      ].join('\n'),
    );
  });

  it('lists what failed in the failed step', () => {
    const tests = {
      step: 'test:coverage',
      outcome: outcome(1, {
        failureLines: ['FAIL  |node| test/git-repo.test.ts > makeTempGitRepo'],
      }),
    } as const;
    expect(formatSummary({results: [tests], failed: tests}, 1000)).toContain(
      [
        'What failed:',
        '  FAIL  |node| test/git-repo.test.ts > makeTempGitRepo',
        'Fix it, then run',
      ].join('\n'),
    );
  });

  it('names the signal when a step was stopped', () => {
    const build = {
      step: 'build',
      outcome: outcome(null, {signal: 'SIGINT'}),
    } as const;
    expect(formatSummary({results: [build], failed: build}, 1000)).toContain(
      '"npm run build" was stopped by SIGINT.',
    );
  });

  it('says when verify stopped a step at its deadline', () => {
    const tests = {
      step: 'test:coverage',
      outcome: outcome(1, {stoppedBy: 'deadline', milliseconds: 600_000}),
    } as const;
    expect(formatSummary({results: [tests], failed: tests}, 1000)).toContain(
      '"npm run test:coverage" ran too long and was stopped after 600.0 s.',
    );
  });

  it('says when verify was interrupted', () => {
    const lint = {
      step: 'lint',
      outcome: outcome(1, {stoppedBy: 'interrupt'}),
    } as const;
    expect(formatSummary({results: [lint], failed: lint}, 1000)).toContain(
      '"npm run lint" was stopped because verify was interrupted.',
    );
  });

  it('names every step that left a process running', () => {
    const left = {leftRunning: true, stoppedBy: 'interrupt'} as const;
    const lint = {step: 'lint', outcome: outcome(1, left)} as const;
    const build = {step: 'build', outcome: outcome(1, left)} as const;
    const summary = formatSummary(
      {
        results: [lint, {step: 'typecheck', outcome: outcome(0)}, build],
        failed: lint,
      },
      1000,
    );
    expect(summary).toContain(
      [
        'A process started by "npm run lint" kept running; check Task Manager.',
        'A process started by "npm run build" kept running; check Task Manager.',
      ].join('\n'),
    );
  });
});

describe('exitCodeFor', () => {
  it('is 0 when every step passed', () => {
    const lint = {step: 'lint', outcome: outcome(0)} as const;
    expect(exitCodeFor({results: [lint], failed: null})).toBe(0);
  });

  it("passes on the failed step's exit code", () => {
    const lint = {step: 'lint', outcome: outcome(2)} as const;
    expect(exitCodeFor({results: [lint], failed: lint})).toBe(2);
  });

  it('is never 0 for a stopped step', () => {
    const stopped = [
      outcome(null, {signal: 'SIGTERM'}),
      outcome(0, {stoppedBy: 'deadline'}),
      outcome(0, {leftRunning: true}),
    ];
    for (const stoppedOutcome of stopped) {
      const lint = {step: 'lint', outcome: stoppedOutcome} as const;
      expect(exitCodeFor({results: [lint], failed: lint})).toBe(1);
    }
  });
});

describe('verify.mts', () => {
  it('loads in plain Node and asks to be run through npm', async () => {
    // NOTE(0913vision): Windows hands Node npm's variables twice, in two
    // cases, and treats both as one, so every spelling has to go.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => name.toLowerCase() !== 'npm_execpath',
      ),
    );
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('verify.mts', import.meta.url))],
      {env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true},
    );
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (text: string) => {
      stderr += text;
    });
    const exitCode = await new Promise<number | null>(resolve => {
      child.once('close', code => resolve(code));
    });
    expect(stderr).toContain('Run this through "npm run verify".');
    expect(exitCode).toBe(1);
  });
});

describe('verify', () => {
  function recordingRun(
    npmCli: string,
    extra: Partial<VerifyRun> = {},
  ): {run: VerifyRun; printed: string[]} {
    const printed: string[] = [];
    const print = (text: string): void => {
      printed.push(text);
    };
    const run: VerifyRun = {
      npmCli,
      steps: ['typecheck'],
      stepDeadlineMs: 600_000,
      interrupt: new AbortController().signal,
      console: {log: print, error: print},
      ...extra,
    };
    return {run, printed};
  }

  it('returns 0 and says so when every step passes', async () => {
    const npmCli = join(await makeTempDir(), 'passing-npm.cjs');
    await writeFile(npmCli, 'process.exitCode = 0;');
    const {run, printed} = recordingRun(npmCli, {
      steps: ['typecheck', 'build'],
    });
    expect(await verify(run)).toBe(0);
    expect(printed.join('\n')).toContain('verify passed: 2 steps');
  });

  it('ends a hung step at its deadline and fails', async () => {
    const npmCli = await writeHungTree(await makeTempDir());
    const {run, printed} = recordingRun(npmCli, {
      steps: ['lint'],
      stepDeadlineMs: 1000,
    });
    expect(await verify(run)).not.toBe(0);
    expect(printed.join('\n')).toContain(
      'verify failed: "npm run lint" ran too long and was stopped after',
    );
  });

  it('stops every running step and its children when interrupted', async () => {
    const dir = await makeTempDir();
    const interruption = new AbortController();
    const {run} = recordingRun(await writeHungTree(dir), {
      steps: ['lint', 'build'],
      interrupt: interruption.signal,
    });
    const running = verify(run);
    const trees = await Promise.all(
      ['lint', 'build'].map(step => waitForHungTree(dir, step)),
    );
    interruption.abort();
    expect(await running).not.toBe(0);
    for (const pid of trees.flatMap(tree => [tree.parent, tree.child])) {
      expect(isRunning(pid)).toBe(false);
    }
  });
});
