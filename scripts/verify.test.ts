import {PassThrough} from 'node:stream';
import {finished} from 'node:stream/promises';
import {describe, expect, it} from 'vitest';
import {
  failureLines,
  formatHeader,
  formatSummary,
  readText,
  runSteps,
  type StepOutcome,
  type VerifyStep,
} from './verify.mts';

const passing: StepOutcome = {
  exitCode: 0,
  signal: null,
  milliseconds: 1500,
  failureLines: [],
};

function failing(
  exitCode: number | null,
  signal: string | null,
  lines: readonly string[] = [],
): StepOutcome {
  return {exitCode, signal, milliseconds: 250, failureLines: lines};
}

describe('runSteps', () => {
  it('runs every step in order when all pass', async () => {
    const ran: string[] = [];
    const result = await runSteps(
      ['typecheck', 'lint', 'build'],
      async (step, position) => {
        ran.push(`${position.number}/${position.total} ${step}`);
        return passing;
      },
    );
    expect(ran).toEqual(['1/3 typecheck', '2/3 lint', '3/3 build']);
    expect(result.failed).toBeNull();
    expect(result.passed.map(p => p.step)).toEqual([
      'typecheck',
      'lint',
      'build',
    ]);
  });

  it('stops at the first failing step', async () => {
    const ran: VerifyStep[] = [];
    const result = await runSteps(
      ['typecheck', 'lint', 'build'],
      async step => {
        ran.push(step);
        return step === 'lint' ? failing(2, null) : passing;
      },
    );
    expect(ran).toEqual(['typecheck', 'lint']);
    expect(result.passed.map(p => p.step)).toEqual(['typecheck']);
    expect(result.failed).toEqual({step: 'lint', outcome: failing(2, null)});
  });

  it('treats a step without an exit code as failed', async () => {
    const result = await runSteps(['test:coverage'], async () =>
      failing(null, 'SIGTERM'),
    );
    expect(result.failed?.step).toBe('test:coverage');
  });
});

describe('formatHeader', () => {
  it('names the step and where it sits in the run', () => {
    expect(formatHeader('lint', {number: 2, total: 5})).toBe(
      '[verify 2/5] npm run lint',
    );
  });
});

describe('formatSummary', () => {
  it('lists each passed step with its time and the total', () => {
    const summary = formatSummary(
      {
        passed: [
          {step: 'typecheck', milliseconds: 1500},
          {step: 'lint', milliseconds: 2500},
        ],
        failed: null,
      },
      2,
    );
    expect(summary).toBe(
      [
        '  ok    typecheck (1.5 s)',
        '  ok    lint (2.5 s)',
        'verify passed: 2 steps in 4.0 s.',
      ].join('\n'),
    );
  });

  it('names the failed step, its exit code, and what to run next', () => {
    const summary = formatSummary(
      {
        passed: [{step: 'typecheck', milliseconds: 1500}],
        failed: {step: 'lint', outcome: failing(1, null)},
      },
      5,
    );
    expect(summary).toBe(
      [
        '  ok    typecheck (1.5 s)',
        '  FAIL  lint (0.3 s)',
        'verify failed at step 2/5: "npm run lint" exited with code 1.',
        'Fix it, then run "npm run lint" alone or "npm run verify" again.',
      ].join('\n'),
    );
  });

  it('lists what failed when the step reported it', () => {
    const summary = formatSummary(
      {
        passed: [],
        failed: {
          step: 'test:coverage',
          outcome: failing(1, null, [
            'FAIL  |node| test/git-repo.test.ts > makeTempGitRepo > writes files',
          ]),
        },
      },
      5,
    );
    expect(summary).toContain(
      [
        'What failed:',
        '  FAIL  |node| test/git-repo.test.ts > makeTempGitRepo > writes files',
        'Fix it, then run',
      ].join('\n'),
    );
  });

  it('names the signal when a step was stopped', () => {
    const summary = formatSummary(
      {passed: [], failed: {step: 'build', outcome: failing(null, 'SIGINT')}},
      5,
    );
    expect(summary).toContain('"npm run build" was stopped by SIGINT.');
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
