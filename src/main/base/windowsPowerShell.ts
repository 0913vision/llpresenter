import {execFile} from 'node:child_process';
import {win32} from 'node:path';

/** What finding Windows PowerShell depends on. */
export interface WindowsEnvironment {
  readonly platform: string;
  /** The Windows folder, from `SystemRoot`. */
  readonly root: string | undefined;
}

/** The environment the app runs in. */
export function currentWindows(): WindowsEnvironment {
  return {platform: process.platform, root: process.env['SystemRoot']};
}

/**
 * Windows PowerShell 5.1 in the Windows folder, never one found on the PATH;
 * none off Windows or without that folder.
 */
export function windowsPowerShell(
  environment: WindowsEnvironment,
): string | null {
  const {platform, root} = environment;
  if (platform !== 'win32' || root === undefined || !win32.isAbsolute(root)) {
    return null;
  }
  return win32.join(
    root,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
}

/**
 * Runs a PowerShell script in a hidden process, which ends with `signal`,
 * after `timeoutMs`, or once it prints more than `maxBytes`.
 *
 * @returns What it printed; it rejects with the process error as the cause.
 */
export function runPowerShell(
  program: string,
  script: string,
  {
    signal,
    timeoutMs,
    maxBytes,
  }: {
    readonly signal: AbortSignal;
    readonly timeoutMs: number;
    readonly maxBytes: number;
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      program,
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: maxBytes,
        signal,
      },
      (error, stdout) => {
        if (error === null) resolve(stdout);
        else reject(new Error('PowerShell failed', {cause: error}));
      },
    );
  });
}
