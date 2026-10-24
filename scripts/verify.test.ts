import {describe, expect, it} from 'vitest';
import {
  formatHeader,
  formatSummary,
  runSteps,
  type StepOutcome,
  type VerifyStep,
} from './verify.mts';

const passing: StepOutcome = {exitCode: 0, signal: null, milliseconds: 1500};

function failing(exitCode: number | null, signal: string | null): StepOutcome {
  return {exitCode, signal, milliseconds: 250};
}

describe('runSteps', () => {
  it('runs every step in order when all pass', () => {
    const ran: string[] = [];
    const result = runSteps(
      ['typecheck', 'lint', 'build'],
      (step, position) => {
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

  it('stops at the first failing step', () => {
    const ran: VerifyStep[] = [];
    const result = runSteps(['typecheck', 'lint', 'build'], step => {
      ran.push(step);
      return step === 'lint' ? failing(2, null) : passing;
    });
    expect(ran).toEqual(['typecheck', 'lint']);
    expect(result.passed.map(p => p.step)).toEqual(['typecheck']);
    expect(result.failed).toEqual({step: 'lint', outcome: failing(2, null)});
  });

  it('treats a step without an exit code as failed', () => {
    const result = runSteps(['test:coverage'], () => failing(null, 'SIGTERM'));
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

  it('names the signal when a step was stopped', () => {
    const summary = formatSummary(
      {passed: [], failed: {step: 'build', outcome: failing(null, 'SIGINT')}},
      5,
    );
    expect(summary).toContain('"npm run build" was stopped by SIGINT.');
  });
});
