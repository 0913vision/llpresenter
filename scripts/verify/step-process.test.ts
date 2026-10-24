import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  isRunning,
  waitForHungTree,
  writeHungTree,
} from '../../test/process-trees';
import {makeTempDir} from '../../test/temp-dir';
import {killProcessTree} from '../process-tree.mts';
import {runStepProcess, type StepCommand} from './step-process.mts';

vi.mock(import('../process-tree.mts'), async importOriginal => {
  const actual = await importOriginal();
  return {killProcessTree: vi.fn(actual.killProcessTree)};
});

const TEN_MINUTES_MS = 600_000;
const CLOSE_GRACE_MS = 5000;

function nodeCommand(
  args: readonly string[],
  extra: Partial<StepCommand> = {},
): StepCommand {
  return {
    name: 'step',
    file: process.execPath,
    args,
    env: process.env,
    deadlineMs: TEN_MINUTES_MS,
    interrupt: new AbortController().signal,
    ...extra,
  };
}

describe('runStepProcess', () => {
  it('reports the exit code, the output, and what failed', async () => {
    const script = [
      "console.log(' FAIL  |node| a.test.ts > adds');",
      "console.log('AssertionError: expected 1 to be 2');",
      'process.exitCode = 3;',
    ].join('\n');
    const outcome = await runStepProcess(nodeCommand(['-e', script]));
    expect(outcome).toMatchObject({exitCode: 3, signal: null, stoppedBy: null});
    expect(outcome.output).toContain('AssertionError: expected 1 to be 2');
    expect(outcome.failureLines).toEqual([
      'FAIL  |node| a.test.ts > adds (AssertionError: expected 1 to be 2)',
    ]);
  });

  it('stops a step that runs past its deadline', async () => {
    const outcome = await runStepProcess(
      nodeCommand(['-e', 'setInterval(() => {}, 1000)'], {deadlineMs: 500}),
    );
    expect(outcome.stoppedBy).toBe('deadline');
    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.output).toContain('[verify stopped step after 0.5 s]');
  });

  it('stops the whole tree when interrupted', async () => {
    const dir = await makeTempDir();
    const interruption = new AbortController();
    const running = runStepProcess(
      nodeCommand([await writeHungTree(dir), 'tree'], {
        interrupt: interruption.signal,
      }),
    );
    const pids = await waitForHungTree(dir, 'tree');
    interruption.abort();
    const outcome = await running;
    expect(outcome.stoppedBy).toBe('interrupt');
    expect(outcome.output).toContain(
      '[verify was interrupted and stopped step]',
    );
    expect(isRunning(pids.parent)).toBe(false);
    expect(isRunning(pids.child)).toBe(false);
  });

  it('lets go of a tree that survives the kill, so it still ends', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.mocked(killProcessTree).mockResolvedValueOnce({
      ok: false,
      reason: 'access denied',
    });
    const dir = await makeTempDir();
    const interruption = new AbortController();
    const running = runStepProcess(
      nodeCommand([await writeHungTree(dir), 'tree'], {
        interrupt: interruption.signal,
      }),
    );
    const pids = await waitForHungTree(dir, 'tree');
    onTestFinished(async () => {
      await killProcessTree(pids.parent);
    });
    interruption.abort();
    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);
    const outcome = await running;
    expect(outcome.exitCode).toBe(1);
    expect(outcome.output).toContain(
      '[verify could not stop all of step: access denied]',
    );
  });

  it('keeps an early failure when the kept output is cut', async () => {
    const script = [
      "console.log(' FAIL  |node| a.test.ts > early');",
      "console.log('Error: early failure');",
      "process.stdout.write('x'.repeat(3_000_000) + '\\n');",
      'process.exitCode = 1;',
    ].join('\n');
    const outcome = await runStepProcess(nodeCommand(['-e', script]));
    expect(outcome.failureLines).toEqual([
      'FAIL  |node| a.test.ts > early (Error: early failure)',
    ]);
    expect(outcome.output).toMatch(
      /^\[verify dropped the first \d+ characters of this output\]\n/,
    );
    expect(outcome.output.length).toBeLessThan(2_000_100);
  });

  it('reports a step that cannot start once', async () => {
    const dir = await makeTempDir();
    const outcome = await runStepProcess({
      ...nodeCommand([]),
      file: join(dir, 'missing.exe'),
    });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.output.match(/could not start step/g)).toHaveLength(1);
  });
});
