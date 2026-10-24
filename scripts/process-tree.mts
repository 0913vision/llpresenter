import {spawn} from 'node:child_process';

/** How an attempt to end a process tree went. */
export type KillResult =
  {readonly ok: true} | {readonly ok: false; readonly reason: string};

const TASKKILL_NO_SUCH_PROCESS = 128;

function killOnWindows(pid: number): Promise<KillResult> {
  return new Promise(resolve => {
    const taskkill = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    taskkill.once('error', error => {
      resolve({ok: false, reason: error.message});
    });
    taskkill.once('close', code => {
      if (code === 0 || code === TASKKILL_NO_SUCH_PROCESS) {
        resolve({ok: true});
        return;
      }
      resolve({
        ok: false,
        reason: `taskkill exited with code ${code ?? 'none'}`,
      });
    });
  });
}

function killAlone(pid: number): KillResult {
  try {
    process.kill(pid, 'SIGKILL');
    return {ok: true};
  } catch (error: unknown) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Ends a process and every process it started. A process that already ended
 * counts as ended.
 */
export async function killProcessTree(pid: number): Promise<KillResult> {
  // NOTE(0913vision): On Windows a process's children outlive it, so only
  // taskkill /t ends the whole tree. Verify runs only on Windows (the push
  // hook and CI), so other systems end the process alone.
  if (process.platform === 'win32') return killOnWindows(pid);
  return killAlone(pid);
}
