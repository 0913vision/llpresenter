import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {describe, expect, it} from 'vitest';
import {isRunning, waitForHungTree, writeHungTree} from '../test/process-trees';
import {makeTempDir} from '../test/temp-dir';
import {killProcessTree} from './process-tree.mts';

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
