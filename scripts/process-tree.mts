import {spawn} from 'node:child_process';

/** How an attempt to end a process tree went. */
export type KillResult =
  {readonly ok: true} | {readonly ok: false; readonly reason: string};

/** How a helper command ended: its exit code, or why it has none. */
export type HelperResult =
  | {readonly kind: 'exited'; readonly exitCode: number}
  | {readonly kind: 'failed'; readonly reason: string};

const MS_PER_SECOND = 1000;
const TASKKILL_NO_SUCH_PROCESS = 128;
const TASKKILL_TIMEOUT_MS = 5000;

/**
 * Runs a short helper command, such as taskkill, and stops it after
 * `timeoutMs`, so a helper that hangs can't keep its caller waiting.
 */
export function runHelper(
  file: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<HelperResult> {
  return new Promise(resolve => {
    const helper = spawn(file, [...args], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: timeoutMs,
    });
    helper.once('error', error => {
      resolve({kind: 'failed', reason: error.message});
    });
    helper.once('close', (exitCode, signal) => {
      if (exitCode !== null) {
        resolve({kind: 'exited', exitCode});
        return;
      }
      resolve({
        kind: 'failed',
        reason: `${file} did not finish within ${timeoutMs / MS_PER_SECOND} s (${signal ?? 'no signal'})`,
      });
    });
  });
}

async function killOnWindows(pid: number): Promise<KillResult> {
  const result = await runHelper(
    'taskkill',
    ['/pid', String(pid), '/t', '/f'],
    TASKKILL_TIMEOUT_MS,
  );
  if (result.kind === 'failed') return {ok: false, reason: result.reason};
  if (result.exitCode === 0 || result.exitCode === TASKKILL_NO_SUCH_PROCESS) {
    return {ok: true};
  }
  return {ok: false, reason: `taskkill exited with code ${result.exitCode}`};
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
 * Ends a process and every process it started that still has a running
 * parent in the tree. A process that already ended counts as ended.
 */
export async function killProcessTree(pid: number): Promise<KillResult> {
  // NOTE(0913vision): taskkill /t follows parent ids, so it reaches only the
  // descendants whose parents still run. A process whose parent ended first,
  // such as one below the cmd.exe that npm starts, is out of its reach, and
  // libuv's job object lets such grandchildren break away. Owning them needs a
  // job object of our own; the lead ruled that out for a dev tool (devops-8
  // round 3), so verify reports a step whose output stays open instead.
  // Verify runs only on Windows (the push hook and CI), so other systems end
  // the process alone.
  if (process.platform === 'win32') return killOnWindows(pid);
  return killAlone(pid);
}
