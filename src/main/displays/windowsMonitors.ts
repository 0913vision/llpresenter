import {execFile} from 'node:child_process';
import {win32} from 'node:path';
import {
  parseWindowsMonitors,
  type NativeMonitorIdentity,
} from '@core/schema/windowsMonitors';
import {WINDOWS_MONITOR_QUERY} from './windowsMonitorQuery';

const QUERY_TIMEOUT_MS = 5_000;
const MAX_REPLY_BYTES = 256 * 1024;

/** Reads metadata without blocking the main thread or opening a console. */
export async function readWindowsMonitors(
  signal: AbortSignal,
): Promise<readonly NativeMonitorIdentity[]> {
  const root = process.env['SystemRoot'];
  if (root === undefined || !win32.isAbsolute(root)) {
    throw new Error('Windows directory unavailable');
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
      (error, stdout) => {
        if (error !== null) {
          reject(new Error('Windows monitor query failed', {cause: error}));
        } else resolve(stdout);
      },
    );
  });
  const value: unknown = JSON.parse(reply);
  const parsed = parseWindowsMonitors(value);
  if (!parsed.ok) {
    throw new Error('Invalid Windows monitor metadata', {cause: parsed.error});
  }
  return parsed.value;
}
