import {describe, expect, it} from 'vitest';
import {FailureScanner} from './failure-scanner.mts';

function scanAll(output: string): string[] {
  const scanner = new FailureScanner();
  scanner.push(output);
  return scanner.finish();
}

describe('FailureScanner', () => {
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
    expect(scanAll(vitestOutput)).toEqual([
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
    expect(scanAll(output)).toEqual([
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
    expect(scanAll(output)).toEqual([
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
    expect(scanAll(output)).toEqual([
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
    expect(scanAll(output)).toEqual([
      'FAIL  |node| test/a.test.ts > first (Error: Test timed out in 60000ms.)',
      'FAIL  |node| test/a.test.ts > second (Error: Test timed out in 60000ms.)',
    ]);
  });

  it('finds nothing in a clean run', () => {
    expect(scanAll(' ✓ |node| scripts/verify.test.ts (9 tests)')).toEqual([]);
  });

  it('keeps at most twenty lines', () => {
    const many = Array.from({length: 30}, (_, i) => ` FAIL  test ${i}`);
    expect(scanAll(many.join('\n'))).toHaveLength(20);
  });

  it('finds the same lines when the output arrives in pieces', () => {
    const scanner = new FailureScanner();
    for (const piece of vitestOutput.match(/[\s\S]{1,7}/g) ?? []) {
      scanner.push(piece);
    }
    expect(scanner.finish()).toEqual(scanAll(vitestOutput));
  });

  it('keeps an early failure when megabytes of output follow', () => {
    const scanner = new FailureScanner();
    scanner.push(' FAIL  |node| test/a.test.ts > early\n');
    scanner.push('Error: early failure\n');
    const filler = `${'x'.repeat(99)}\n`.repeat(650);
    for (let i = 0; i < 50; i += 1) scanner.push(filler);
    expect(scanner.finish()).toEqual([
      'FAIL  |node| test/a.test.ts > early (Error: early failure)',
    ]);
  });

  it('reads only the start of a very long line', () => {
    const scanner = new FailureScanner();
    scanner.push(` FAIL  test ${'y'.repeat(10_000)}`);
    const [line] = scanner.finish();
    expect(line?.length).toBeLessThan(5000);
    expect(line?.startsWith('FAIL  test y')).toBe(true);
  });
});
