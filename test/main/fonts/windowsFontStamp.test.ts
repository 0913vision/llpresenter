import type {ExecFileOptionsWithStringEncoding} from 'node:child_process';
import {expect, it, vi} from 'vitest';
import {readWindowsFontStamp} from '@main/fonts/windowsFontStamp';

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
const environment = {platform: 'win32', root: 'C:\\Windows'} as const;

it('fingerprints both font folders and registry hives using a bounded hidden cancellable process', async () => {
  native.exec.mockImplementation((...args) => args[3](null, 'a'.repeat(64)));
  const signal = new AbortController().signal;
  expect(await readWindowsFontStamp(signal, environment)).toBe('a'.repeat(64));
  const call = native.exec.mock.calls.at(-1);
  expect(call?.[2]).toMatchObject({
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 1024,
    signal,
  });
  const query = call?.[1].at(-1);
  for (const term of [
    'SystemRoot',
    'LOCALAPPDATA',
    'HKLM:',
    'HKCU:',
    'FontSubstitutes',
    'LastWriteTimeUtc',
    'GetValueNames',
  ]) {
    expect(query).toContain(term);
  }
});

it('rejects failed and malformed stamp replies', async () => {
  for (const [error, reply] of [
    [Error('timeout'), ''],
    [null, 'partial'],
  ] as const) {
    native.exec.mockImplementation((...args) => args[3](error, reply));
    await expect(
      readWindowsFontStamp(new AbortController().signal, environment),
    ).rejects.toThrow('fingerprint');
  }
});
