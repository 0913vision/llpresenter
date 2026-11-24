import {execFile} from 'node:child_process';
import {win32} from 'node:path';
import {
  parseWindowsMonitors,
  type NativeMonitorIdentity,
} from '@core/schema/screens/windowsMonitors';
import {WINDOWS_MONITOR_QUERY} from './windowsMonitorQuery';

const QUERY_TIMEOUT_MS = 5_000;
const MAX_REPLY_BYTES = 256 * 1024;

/** How the Windows monitor query can fail. */
export type MonitorQueryFailure =
  | 'timeout'
  | 'PowerShell error'
  | 'WMI error'
  | 'invalid result'
  | 'Windows directory unavailable';

/**
 * Thrown when the Windows monitor query fails; `reason` says how and `cause`
 * holds the original error.
 */
export class MonitorQueryError extends Error {
  constructor(
    readonly reason: MonitorQueryFailure,
    cause?: unknown,
  ) {
    super('Windows monitor query failed', {cause});
  }
}

/** Reads metadata without blocking the main thread or opening a console. */
export async function readWindowsMonitors(
  signal: AbortSignal,
): Promise<readonly NativeMonitorIdentity[]> {
  const root = process.env['SystemRoot'];
  if (root === undefined || !win32.isAbsolute(root)) {
    throw new MonitorQueryError('Windows directory unavailable');
  }
  const program = win32.join(
    root,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const reply = await new Promise<string>((resolve, reject) => {
    execFile(
      program,
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_MONITOR_QUERY],
      {
        windowsHide: true,
        encoding: 'utf8',
        timeout: QUERY_TIMEOUT_MS,
        maxBuffer: MAX_REPLY_BYTES,
        signal,
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          const timeout = 'killed' in error && error.killed && !signal.aborted;
          const reason = timeout
            ? 'timeout'
            : /WmiMonitorID|Get-CimInstance/i.test(stderr)
              ? 'WMI error'
              : 'PowerShell error';
          reject(new MonitorQueryError(reason, error));
        } else resolve(stdout);
      },
    );
  });
  let value: unknown;
  try {
    value = JSON.parse(reply);
  } catch (error) {
    throw new MonitorQueryError('invalid result', error);
  }
  const parsed = parseWindowsMonitors(value);
  if (!parsed.ok) {
    throw new MonitorQueryError('invalid result', parsed.error);
  }
  return parsed.value;
}
