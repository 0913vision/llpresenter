import type {ChildProcess} from 'node:child_process';
import type {ElectronApplication} from 'playwright-core';
import {killProcessTree} from '../../scripts/process-tree.mts';

const CLOSE_GRACE_MS = 5000;

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function within(promise: Promise<unknown>, timeout: number): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeout);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

/** Waits for a normal quit, then ends the process tree if the app refuses. */
export async function stopElectron(app: ElectronApplication): Promise<boolean> {
  const child = app.process();
  if (hasExited(child)) return false;
  const exited = new Promise<void>(resolve =>
    child.once('exit', () => resolve()),
  );
  const close = app.close().catch(() => undefined);
  if (await within(Promise.all([close, exited]), CLOSE_GRACE_MS)) return false;
  let forced = false;
  if (!hasExited(child)) {
    if (child.pid === undefined) throw new Error('Electron process has no pid');
    const killed = await killProcessTree(child.pid);
    if (!killed.ok) {
      throw new Error(`Could not stop Electron: ${killed.reason}`);
    }
    forced = true;
  }
  if (!hasExited(child) && !(await within(exited, CLOSE_GRACE_MS))) {
    throw new Error('Electron did not exit after its process tree was stopped');
  }
  return forced;
}
