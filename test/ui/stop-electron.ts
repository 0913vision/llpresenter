import type {ChildProcess} from 'node:child_process';
import type {ElectronApplication} from 'playwright-core';
import {killProcessTree, runHelper} from '../../scripts/process-tree.mts';

// NOTE(0913vision): With coverage and CI's software renderer, a loaded theme
// close spent 0.53 s flushing, 0.38 s closing windows, then 4.47 s exiting
// Chromium. Another normal quit took 9.74 s; even 15 s forced one loaded run.
// Allow 30 s of grace, then force and report a hung quit instead of hiding it.
export const CLOSE_GRACE_MS = 30_000;
const KILL_GRACE_MS = 5000;
// NOTE(0913vision): 60 forced stops across 20 offscreen restart rounds took
// 1,203–13,764 ms to exit on this machine. Reuse the existing shutdown bound
// as a failure deadline; the wait completes as soon as both processes exit.
export const CRASH_EXIT_LIMIT_MS = CLOSE_GRACE_MS;

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
export async function stopElectron(
  app: Pick<ElectronApplication, 'process' | 'close'>,
  child: ChildProcess = app.process(),
): Promise<boolean> {
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
    forced = true;
    // NOTE(0913vision): taskkill /t /f exits 255 when a child in the tree is
    // already gone or ending, even though the app itself is stopped. Whether
    // Electron exited is the result that matters, so the reason is kept only
    // for the error below.
    if (!hasExited(child) && !(await within(exited, KILL_GRACE_MS))) {
      const reason = killed.ok ? 'its process tree was stopped' : killed.reason;
      throw new Error(`Electron did not exit: ${reason}`);
    }
    return forced;
  }
  if (!hasExited(child) && !(await within(exited, KILL_GRACE_MS))) {
    throw new Error('Electron did not exit after its process tree was stopped');
  }
  return forced;
}

/** Holds the main process handle before stopping the launcher tree. */
async function killAndWaitForMain(
  pid: number,
  child: ChildProcess,
  exited: Promise<void>,
): Promise<void> {
  if (child.pid === undefined) throw new Error('Electron launcher has no pid');
  if (process.platform !== 'win32') {
    if (pid !== child.pid) {
      throw new Error(
        `Cannot stop Electron main process ${pid}: it differs from launcher ${child.pid}`,
      );
    }
    await killProcessTree(child.pid);
    await exited;
    return;
  }
  if (
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    !Number.isSafeInteger(child.pid) ||
    child.pid <= 0
  ) {
    throw new Error('Invalid Electron process id');
  }
  const command = `$ErrorActionPreference = 'Stop'; $target = Get-Process -Id ${pid} -ErrorAction Stop; $null = $target.Handle; & taskkill.exe /pid ${pid} /t /f | Out-Null; $target.WaitForExit()`;
  const result = await runHelper(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    CRASH_EXIT_LIMIT_MS,
  );
  if (result.kind !== 'exited' || result.exitCode !== 0) {
    throw new Error(
      result.kind === 'failed'
        ? result.reason
        : `process waiter exited with code ${result.exitCode}`,
    );
  }
}

/** Simulates a crash and waits for both the actual Electron main and its launcher. */
export async function crashElectron(
  app: Pick<ElectronApplication, 'process' | 'evaluate'>,
  terminate: typeof killAndWaitForMain = killAndWaitForMain,
  child: ChildProcess = app.process(),
): Promise<void> {
  if (child.pid === undefined) throw new Error('Electron launcher has no pid');
  if (hasExited(child)) {
    throw new Error('Electron launcher exited before the crash');
  }
  const mainPid = await app.evaluate(() => process.pid);
  if (hasExited(child)) {
    throw new Error('Electron launcher exited before the crash');
  }
  const exited = new Promise<void>(resolve =>
    child.once('exit', () => resolve()),
  );
  let watchError: unknown;
  const mainExited = terminate(mainPid, child, exited).catch(
    (error: unknown) => {
      watchError = error;
      throw error;
    },
  );
  const complete = await within(
    Promise.all([exited, mainExited]),
    CRASH_EXIT_LIMIT_MS,
  );
  if (!complete) {
    if (watchError !== undefined) {
      throw new Error(
        `Could not confirm Electron main process ${mainPid} exited`,
        {cause: watchError},
      );
    }
    throw new Error(
      `Electron main process ${mainPid} or launcher ${child.pid} did not exit within ${CRASH_EXIT_LIMIT_MS} ms after forced stop`,
    );
  }
}
