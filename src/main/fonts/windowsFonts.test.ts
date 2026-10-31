import type {ExecFileOptionsWithStringEncoding} from 'node:child_process';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import {FONT_QUERY_TIMEOUT_MS, readWindowsFonts} from './windowsFonts';

type Exec = (
  ...args: [
    program: string,
    args: readonly string[],
    options: ExecFileOptionsWithStringEncoding,
    done: (error: Error | null, stdout: string, stderr: string) => void,
  ]
) => void;
const native = vi.hoisted(() => ({exec: vi.fn<Exec>()}));
vi.mock('node:child_process', () => ({execFile: native.exec}));
const environment = {platform: 'win32', root: 'C:\\data'} as const;

beforeEach(() => {
  native.exec.mockReset();
});
afterEach(() => vi.restoreAllMocks());

it('uses a hidden bounded process and decodes Unicode font metadata', async () => {
  native.exec.mockImplementation((...args) =>
    args[3](null, JSON.stringify([fontFamilyFixture()]), ''),
  );
  const controller = new AbortController();
  expect(await readWindowsFonts(controller.signal, environment)).toEqual([
    fontFamilyFixture(),
  ]);
  expect(native.exec.mock.calls[0]).toEqual([
    'C:\\data\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    expect.arrayContaining(['-NoProfile', '-NonInteractive', '-Command']),
    expect.objectContaining({
      windowsHide: true,
      timeout: FONT_QUERY_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
      signal: controller.signal,
    }),
    expect.any(Function),
  ]);
});

it.each(['bad json', JSON.stringify([{...fontFamilyFixture(), weights: [0]}])])(
  'rejects invalid native replies',
  async text => {
    native.exec.mockImplementation((...args) => args[3](null, text, ''));
    await expect(
      readWindowsFonts(new AbortController().signal, environment),
    ).rejects.toThrow();
  },
);

it('propagates a failed command and does not spawn on unsupported systems', async () => {
  native.exec.mockImplementation((...args) =>
    args[3](new Error('Command failed'), '', ''),
  );
  await expect(
    readWindowsFonts(new AbortController().signal, environment),
  ).rejects.toThrow('Windows font query failed');
  native.exec.mockClear();
  await expect(
    readWindowsFonts(new AbortController().signal, {
      platform: 'linux',
      root: undefined,
    }),
  ).rejects.toThrow('unavailable');
  expect(native.exec).not.toHaveBeenCalled();
});
