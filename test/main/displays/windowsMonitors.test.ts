import type {ExecFileOptionsWithStringEncoding} from 'node:child_process';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {readWindowsMonitors} from '@main/displays/windowsMonitors';
import {IdentityDisplaySource} from '@main/displays/identitySource';
import {assignMonitors} from '@main/displays/assign';
import {numberMonitors} from '@main/displays/monitor';
import {
  displayInfo,
  MockDisplaySource,
  recordingLogger,
} from '@fixtures/main/displays/testing';

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

beforeEach(() => {
  native.exec.mockReset();
  vi.stubEnv('SystemRoot', 'C:\\Windows');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it.each(['blocked', 'timeout'])(
  'falls back after %s, waits for a new event, then enforces a successful mismatch',
  async failure => {
    vi.useFakeTimers();
    const display = displayInfo({id: 2, x: 1920});
    const raw = new MockDisplaySource(display);
    const log = recordingLogger();
    const source = new IdentityDisplaySource({
      source: raw,
      query: readWindowsMonitors,
      pixelBounds: entry => entry.bounds,
      log,
    });
    const assignment = () =>
      assignMonitors({
        monitors: numberMonitors(source.read()),
        requests: [
          {
            screenId: 'main',
            display: {
              ...display,
              identity: {
                kind: 'windows',
                devicePath: 'old-path',
                edid: {manufacturer: 'DEL', product: '1234', serial: 'SAVED'},
              },
            },
          },
        ],
        controlMonitorId: 1,
        previous: new Map(),
      }).get('main')?.id;
    native.exec.mockImplementationOnce((...args) => {
      const fail = () => args[3](new Error(failure), '', '');
      if (failure === 'timeout') setTimeout(fail, args[2].timeout);
      else fail();
    });
    const stop = source.watch(vi.fn());
    expect(assignment()).toBe(2);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4999);
    expect(assignment()).toBe(2);
    if (failure === 'timeout') {
      expect(source.read()[0]?.identityPending).toBe(true);
    }
    await vi.advanceTimersByTimeAsync(1);
    expect(source.read()[0]).toMatchObject({
      identityPending: false,
      identityUnknown: true,
    });
    expect(assignment()).toBe(2);
    await vi.advanceTimersByTimeAsync(60000);
    expect(native.exec).toHaveBeenCalledTimes(1);
    expect(log.messages('warn')).toHaveLength(1);

    let complete: Parameters<Exec>[3] = () => undefined;
    native.exec.mockImplementationOnce((...args) => {
      complete = args[3];
    });
    raw.emit();
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(1000);
    expect(assignment()).toBe(2);
    complete(
      null,
      JSON.stringify({
        paths: [
          {
            bounds: display.bounds,
            devicePath: String.raw`\\?\DISPLAY#DEL1234#instance#{e6f07b5f-ee97-4a90-b076-33f57bf4eaa7}`,
          },
        ],
        wmi: [
          {
            instanceName: String.raw`DISPLAY\DEL1234\instance_0`,
            manufacturer: 'DEL',
            product: '1234',
            serial: 'OTHER',
          },
        ],
      }),
      '',
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(source.read()[0]).toMatchObject({
      identityPending: false,
      identityUnknown: false,
    });
    expect(assignment()).toBeUndefined();
    expect(native.exec).toHaveBeenCalledTimes(2);
    expect(log.messages('warn')).toHaveLength(1);
    stop();
  },
);

it('bounds and hides the native reader and propagates cancellation', async () => {
  native.exec.mockImplementation((...args) =>
    args[3](null, '{"paths":[],"wmi":[]}', ''),
  );
  const controller = new AbortController();
  expect(await readWindowsMonitors(controller.signal)).toEqual([]);
  expect(native.exec.mock.calls[0]).toEqual([
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    expect.arrayContaining(['-NoProfile', '-NonInteractive', '-Command']),
    expect.objectContaining({
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 256 * 1024,
      signal: controller.signal,
    }),
    expect.any(Function),
  ]);
});

it.each(['bad JSON', '{"paths":"wrong","wmi":[]}'])(
  'rejects malformed native output %s',
  async stdout => {
    native.exec.mockImplementation((...args) => args[3](null, stdout, ''));
    await expect(
      readWindowsMonitors(new AbortController().signal),
    ).rejects.toThrow();
  },
);

it('rejects timeout/abort/command failures without using partial output', async () => {
  native.exec.mockImplementation((...args) =>
    args[3](new Error('aborted'), '{"paths":[],"wmi":[]}', ''),
  );
  await expect(
    readWindowsMonitors(new AbortController().signal),
  ).rejects.toThrow('Windows monitor query failed');
  native.exec.mockClear();
  vi.stubEnv('SystemRoot', undefined);
  await expect(
    readWindowsMonitors(new AbortController().signal),
  ).rejects.toThrow('Windows directory unavailable');
  expect(native.exec).not.toHaveBeenCalled();
});
