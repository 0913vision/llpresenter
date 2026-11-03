import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  isRunning,
  waitForHungTree,
  writeHungTree,
} from '../test/fixtures/processTrees';
import {makeTempDir} from '../test/fixtures/tempDir';
import {
  isProcessRunning,
  killProcessTree,
  runHelper,
  taskkillOutcome,
} from './process-tree.mts';

describe('killProcessTree', () => {
  it('ends a process and the child it started', async () => {
    const dir = await makeTempDir();
    const tree = spawn(process.execPath, [await writeHungTree(dir), 'tree'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    const closed = once(tree, 'close');
    const pids = await waitForHungTree(dir, 'tree');
    expect(await killProcessTree(pids.parent)).toEqual({ok: true});
    await closed;
    expect(isRunning(pids.parent)).toBe(false);
    expect(isRunning(pids.child)).toBe(false);
  });

  it('counts a process that already ended as ended', async () => {
    const done = spawn(process.execPath, ['-e', ''], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await once(done, 'close');
    expect(done.pid).toBeDefined();
    expect(await killProcessTree(done.pid ?? 0)).toEqual({ok: true});
  });
});

describe('runHelper', () => {
  it('reports the exit code of a helper that ends', async () => {
    expect(
      await runHelper(process.execPath, ['-e', 'process.exit(3)'], 30_000),
    ).toEqual({kind: 'exited', exitCode: 3});
  });

  it('stops a helper that hangs at its time limit', async () => {
    const result = await runHelper(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      500,
    );
    expect(result).toEqual({
      kind: 'failed',
      reason: `${process.execPath} did not finish within 0.5 s (SIGTERM)`,
    });
  });

  it('reports a helper that cannot start', async () => {
    const missing = join(await makeTempDir(), 'missing.exe');
    expect(await runHelper(missing, [], 30_000)).toEqual({
      kind: 'failed',
      reason: `spawn ${missing} ENOENT`,
    });
  });
});

describe('taskkillOutcome', () => {
  const PID = 4242;
  const gone = () => false;
  const alive = () => true;

  it('counts exit codes 0 and 128 as ended without looking at the process', () => {
    const neverAsked = () => {
      throw new Error('The process must not be asked');
    };
    expect(
      taskkillOutcome(PID, {kind: 'exited', exitCode: 0}, neverAsked),
    ).toEqual({ok: true});
    expect(
      taskkillOutcome(PID, {kind: 'exited', exitCode: 128}, neverAsked),
    ).toEqual({ok: true});
  });

  it('counts a non-zero exit as ended when the process is gone', () => {
    expect(taskkillOutcome(PID, {kind: 'exited', exitCode: 1}, gone)).toEqual({
      ok: true,
    });
  });

  it('counts a taskkill that failed or hung as ended when the process is gone', () => {
    expect(
      taskkillOutcome(PID, {kind: 'failed', reason: 'timed out'}, gone),
    ).toEqual({ok: true});
  });

  it('keeps the reason and names the process that still runs', () => {
    expect(taskkillOutcome(PID, {kind: 'exited', exitCode: 1}, alive)).toEqual({
      ok: false,
      reason: 'taskkill exited with code 1, and process 4242 still runs',
    });
    expect(
      taskkillOutcome(
        PID,
        {kind: 'failed', reason: 'spawn taskkill ENOENT'},
        alive,
      ),
    ).toEqual({
      ok: false,
      reason: 'spawn taskkill ENOENT, and process 4242 still runs',
    });
  });
});

describe('isProcessRunning', () => {
  it('sees this process and not one that ended', async () => {
    expect(isProcessRunning(process.pid)).toBe(true);
    const done = spawn(process.execPath, ['-e', ''], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await once(done, 'close');
    expect(isProcessRunning(done.pid ?? 0)).toBe(false);
  });
});
