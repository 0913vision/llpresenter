import {PassThrough} from 'node:stream';
import {finished} from 'node:stream/promises';
import {describe, expect, it} from 'vitest';
import {
  failureLines,
  formatStepReport,
  formatSummary,
  readText,
  runSteps,
  type StepOutcome,
  type VerifyStep,
} from './verify.mts';

function outcome(
  exitCode: number | null,
  extra: Partial<StepOutcome> = {},
): StepOutcome {
  return {exitCode, signal: null, milliseconds: 1500, output: '', ...extra};
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

  it('lists what failed from the failed step output', () => {
    const tests = {
      step: 'test:coverage',
      outcome: outcome(1, {
        output: ' FAIL  |node| test/git-repo.test.ts > makeTempGitRepo\n',
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
});

describe('failureLines', () => {
  const RED = '\x1b[31m';
  const RESET = '\x1b[39m';
  const vitestOutput = [
    ' RUN  v5.0.5 D:/llp',
    `${RED} FAIL ${RESET} |node| test/git-repo.test.ts > makeTempGitRepo > writes files`,
    ' ✓ |node| scripts/verify.test.ts (9 tests) 12ms',
    '   × writes files 5625ms',
    '⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯',
    'Error: [vitest-pool]: Failed to start forks worker for test files D:/llp/src/renderer/src/ui/Checkbox.test.tsx',
    ' FAIL  |node| test/git-repo.test.ts > makeTempGitRepo > writes files',
    '      Tests  1 failed | 736 passed (737)',
  ].join('\r\n');

  it('keeps failed tests, worker start errors, and unhandled blocks, once each', () => {
    expect(failureLines(vitestOutput)).toEqual([
      'FAIL  |node| test/git-repo.test.ts > makeTempGitRepo > writes files',
      '× writes files 5625ms',
      'Unhandled Errors',
      'Error: [vitest-pool]: Failed to start forks worker for test files D:/llp/src/renderer/src/ui/Checkbox.test.tsx',
    ]);
  });

  it('keeps the first error line of each failed test', () => {
    const output = [
      ' FAIL  |node| test/a.test.ts > waits',
      ' FAIL  |node| test/b.test.ts > reads',
      '',
      ' FAIL  |node| test/a.test.ts > waits',
      'Error: Test timed out in 60000ms.',
      'If this is a long-running test, pass a timeout value as the last argument.',
      ' ❯ test/a.test.ts:3:1',
      '',
      ' FAIL  |node| test/b.test.ts > reads',
      'AssertionError: expected 1 to be 2 // Object.is equality',
    ].join('\n');
    expect(failureLines(output)).toEqual([
      'FAIL  |node| test/a.test.ts > waits (Error: Test timed out in 60000ms.)',
      'FAIL  |node| test/b.test.ts > reads (AssertionError: expected 1 to be 2 // Object.is equality)',
    ]);
  });

  it('names an unhandled rejection when no test failed', () => {
    const output = [
      ' ✓ |node| test/a.test.ts (3 tests) 12ms',
      '⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯',
      '',
      'Vitest caught 1 unhandled error during the test run.',
      'This might cause false positive tests.',
      '',
      '⎯⎯⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯⎯',
      "TypeError: Cannot read properties of undefined (reading 'x')",
      ' ❯ src/a.ts:3:1',
    ].join('\n');
    expect(failureLines(output)).toEqual([
      'Unhandled Errors',
      'Vitest caught 1 unhandled error during the test run.',
      "Unhandled Rejection (TypeError: Cannot read properties of undefined (reading 'x'))",
    ]);
  });

  it('keeps two different unhandled rejections apart', () => {
    const output = [
      '⎯⎯⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯⎯',
      "TypeError: Cannot read properties of undefined (reading 'x')",
      ' ❯ src/a.ts:3:1',
      '',
      '⎯⎯⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯⎯',
      'RangeError: Invalid array length',
      ' ❯ src/b.ts:9:5',
    ].join('\n');
    expect(failureLines(output)).toEqual([
      "Unhandled Rejection (TypeError: Cannot read properties of undefined (reading 'x'))",
      'Unhandled Rejection (RangeError: Invalid array length)',
    ]);
  });

  it('gives grouped failures their shared error', () => {
    const output = [
      ' FAIL  |node| test/a.test.ts > first',
      ' FAIL  |node| test/a.test.ts > second',
      'Error: Test timed out in 60000ms.',
      ' ❯ test/a.test.ts:3:1',
    ].join('\n');
    expect(failureLines(output)).toEqual([
      'FAIL  |node| test/a.test.ts > first (Error: Test timed out in 60000ms.)',
      'FAIL  |node| test/a.test.ts > second (Error: Test timed out in 60000ms.)',
    ]);
  });

  it('finds nothing in a clean run', () => {
    expect(failureLines(' ✓ |node| scripts/verify.test.ts (9 tests)')).toEqual(
      [],
    );
  });

  it('keeps at most twenty lines', () => {
    const many = Array.from({length: 30}, (_, i) => ` FAIL  test ${i}`);
    expect(failureLines(many.join('\n'))).toHaveLength(20);
  });
});

describe('readText', () => {
  it('keeps a character whole when it is split across two chunks', async () => {
    const stream = new PassThrough();
    const texts: string[] = [];
    readText(stream, text => texts.push(text));
    const cross = Buffer.from('× done', 'utf8');
    stream.write(cross.subarray(0, 1));
    stream.write(cross.subarray(1));
    stream.end();
    await finished(stream);
    expect(texts.join('')).toBe('× done');
  });
});
