import type {ExecFileOptionsWithStringEncoding} from 'node:child_process';
import {expect, it, vi} from 'vitest';
import {runPowerShell, windowsPowerShell} from '@main/base/windowsPowerShell';

type Exec = (
  ...args: [
    program: string,
    args: readonly string[],
    options: ExecFileOptionsWithStringEncoding,
    done: (error: Error | null, stdout: string) => void,
  ]
) => void;
const native = vi.hoisted(() => ({exec: vi.fn<Exec>()}));
vi.mock('node:child_process', () => ({execFile: native.exec}));

it('finds Windows PowerShell in the Windows folder only', () => {
  expect(
    windowsPowerShell({platform: 'win32', root: String.raw`C:\Windows`}),
  ).toBe(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
  expect(windowsPowerShell({platform: 'win32', root: undefined})).toBeNull();
  expect(windowsPowerShell({platform: 'win32', root: 'Windows'})).toBeNull();
  expect(
    windowsPowerShell({platform: 'linux', root: String.raw`C:\Windows`}),
  ).toBeNull();
});

it('runs a script hidden, bounded in time and output, and ends with the signal', async () => {
  native.exec.mockImplementation((...args) => args[3](null, 'printed'));
  const signal = new AbortController().signal;
  expect(
    await runPowerShell('ps.exe', 'Get-Date', {
      signal,
      timeoutMs: 5000,
      maxBytes: 64,
    }),
  ).toBe('printed');
  const call = native.exec.mock.lastCall;
  expect(call?.[1]).toEqual([
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    'Get-Date',
  ]);
  expect(call?.[2]).toMatchObject({
    windowsHide: true,
    timeout: 5000,
    maxBuffer: 64,
    signal,
  });
});

it('rejects with the process error as its cause', async () => {
  const failure = new Error('timed out');
  native.exec.mockImplementation((...args) => args[3](failure, ''));
  await expect(
    runPowerShell('ps.exe', 'Get-Date', {
      signal: new AbortController().signal,
      timeoutMs: 5000,
      maxBytes: 64,
    }),
  ).rejects.toMatchObject({message: 'PowerShell failed', cause: failure});
});
