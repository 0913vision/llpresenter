import {spawn} from 'node:child_process';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';

/** What a PowerPoint process looks like from outside: alive, and with a window of its own. */
export interface PowerPointProcessState {
  readonly alive: boolean;
  /** It shows a window, so the operator may be working in it. */
  readonly windowed: boolean;
}

/** Looks at and ends PowerPoint processes by their id. */
export interface PowerPointProcesses {
  inspect(pid: number): Promise<PowerPointProcessState>;
  /** Ends the process; true when it is gone. */
  end(pid: number): Promise<boolean>;
}

/**
 * Where the app remembers the PowerPoint process it started, so one left
 * behind by a crash or a hang is still known after the app starts again.
 */
export interface StartedPowerPointStore {
  read(): number | null;
  write(pid: number | null): void;
}

const GONE: PowerPointProcessState = {alive: false, windowed: false};
const INSPECT_LIMIT_MS = 5000;

/**
 * The PowerShell lines that print whether process `pid` is PowerPoint, and
 * whether it has a window: `ALIVE 0|1`, or nothing when it is not running.
 */
function inspectScript(pid: number): string {
  return [
    `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
    "if ($p -and $p.ProcessName -eq 'POWERPNT') {",
    "  [Console]::Out.WriteLine(('ALIVE {0}' -f [int]($p.MainWindowHandle -ne 0)))",
    '}',
  ].join('\n');
}

/** The Windows processes, through PowerShell and the process table. */
export const windowsPowerPointProcesses: PowerPointProcesses = {
  inspect: pid =>
    new Promise(resolve => {
      if (!Number.isSafeInteger(pid) || pid <= 0) {
        resolve(GONE);
        return;
      }
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          Buffer.from(inspectScript(pid), 'utf16le').toString('base64'),
        ],
        {windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']},
      );
      let output = '';
      const limit = setTimeout(() => {
        child.kill();
        resolve(GONE);
      }, INSPECT_LIMIT_MS);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output += chunk;
      });
      const done = (): void => {
        clearTimeout(limit);
        const match = /ALIVE (\d)/.exec(output);
        resolve(match ? {alive: true, windowed: match[1] === '1'} : GONE);
      };
      child.once('error', done);
      child.once('close', done);
    }),
  end: async pid => {
    try {
      process.kill(pid);
    } catch {
      // NOTE(0913vision): It ended meanwhile, or it cannot be ended.
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      if (!(await windowsPowerPointProcesses.inspect(pid)).alive) return true;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  },
};

/** The started PowerPoint kept in a small file of the app's data folder. */
export function fileStartedPowerPoint(file: string): StartedPowerPointStore {
  return {
    read: () => {
      try {
        const pid = Number(readFileSync(file, 'utf8').trim());
        return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
      } catch {
        return null;
      }
    },
    write: pid => {
      try {
        if (pid === null) rmSync(file, {force: true});
        else writeFileSync(file, String(pid));
      } catch {
        // NOTE(0913vision): Only remembering fails; the run itself goes on.
      }
    },
  };
}

/**
 * Ends the PowerPoint this app started and left behind, before a new run
 * uses PowerPoint. One with a window is left alone: the operator may have
 * opened a presentation in it.
 *
 * @returns Whether one was ended.
 */
export async function endLeftPowerPoint(
  store: StartedPowerPointStore,
  processes: PowerPointProcesses,
): Promise<boolean> {
  const pid = store.read();
  if (pid === null) return false;
  const state = await processes.inspect(pid);
  if (!state.alive || state.windowed) {
    store.write(null);
    return false;
  }
  const ended = await processes.end(pid);
  if (ended) store.write(null);
  return ended;
}
