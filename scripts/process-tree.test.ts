import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {isRunning, waitForHungTree, writeHungTree} from '../test/process-trees';
import {makeTempDir} from '../test/temp-dir';
import {killProcessTree, runHelper} from './process-tree.mts';

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
