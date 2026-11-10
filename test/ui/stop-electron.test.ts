import {ChildProcess} from 'node:child_process';
import {expect, it, vi} from 'vitest';
import {killProcessTree} from '../../scripts/process-tree.mts';
import {installMockClock} from '@fixtures/mockClock';
import {
  CLOSE_GRACE_MS,
  CRASH_EXIT_LIMIT_MS,
  crashElectron,
  stopElectron,
} from './stop-electron';

vi.mock('../../scripts/process-tree.mts', () => ({
  killProcessTree: vi.fn(),
  runHelper: vi.fn(),
}));

const MOCK_ELECTRON_PID = 1234;

function mockApplication() {
  const mockChild = new ChildProcess();
  Object.defineProperty(mockChild, 'pid', {value: MOCK_ELECTRON_PID});
  const mockExit = (): void => {
    Object.defineProperty(mockChild, 'exitCode', {value: 0});
    mockChild.emit('exit', 0, null);
  };
  const mockApp = {
    process: () => mockChild,
    close: vi.fn(() => new Promise<void>(() => undefined)),
  };
  const mockKill = vi.mocked(killProcessTree).mockReset();
  return {mockApp, mockExit, mockKill};
}

it('lets a six-second normal quit finish without killing it', async () => {
  const clock = installMockClock();
  const {mockApp, mockExit, mockKill} = mockApplication();
  const slowQuitMs = 6000;
  mockApp.close.mockImplementation(
    () =>
      new Promise(resolve => {
        setTimeout(() => {
          mockExit();
          resolve();
        }, slowQuitMs);
      }),
  );
  const stopped = stopElectron(mockApp);
  await clock.advance(slowQuitMs);
  expect(await stopped).toBe(false);
  expect(mockKill).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('reports a forced stop when the app never quits within the grace', async () => {
  const clock = installMockClock();
  const {mockApp, mockExit, mockKill} = mockApplication();
  mockKill.mockImplementation(async () => {
    mockExit();
    return {ok: true};
  });
  const stopped = stopElectron(mockApp);
  await clock.advance(CLOSE_GRACE_MS - 1);
  expect(mockKill).not.toHaveBeenCalled();
  await clock.advance(1);
  expect(await stopped).toBe(true);
  expect(mockKill).toHaveBeenCalledExactlyOnceWith(MOCK_ELECTRON_PID);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects five seconds after a forced stop if the process stays alive', async () => {
  const clock = installMockClock();
  const {mockApp, mockKill} = mockApplication();
  mockKill.mockResolvedValue({ok: false, reason: 'mock process stayed alive'});
  let settled = false;
  const stopping = stopElectron(mockApp).finally(() => {
    settled = true;
  });
  const rejected = expect(stopping).rejects.toThrow(
    'Electron did not exit: mock process stayed alive',
  );
  await clock.advance(CLOSE_GRACE_MS);
  expect(mockKill).toHaveBeenCalledExactlyOnceWith(MOCK_ELECTRON_PID);
  await clock.advance(4999);
  expect(settled).toBe(false);
  await clock.advance(1);
  await rejected;
  expect(settled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('waits for the actual Electron main process after the launcher exits', async () => {
  const clock = installMockClock();
  const {mockApp, mockExit, mockKill} = mockApplication();
  let finishMain: () => void = () => undefined;
  const mainExit = new Promise<void>(resolve => {
    finishMain = resolve;
  });
  const watch = vi.fn(() => mainExit);
  const app = {...mockApp, evaluate: vi.fn().mockResolvedValue(4321)};
  mockKill.mockResolvedValue({ok: true});
  let settled = false;
  const stopping = crashElectron(app, watch).finally(() => {
    settled = true;
  });
  await clock.advance(0);
  mockExit();
  await clock.advance(0);
  expect(settled).toBe(false);
  expect(watch).toHaveBeenCalledWith(
    4321,
    mockApp.process(),
    expect.any(Promise),
  );
  finishMain();
  await stopping;
  expect(settled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('waits for the launcher when the main process exits first', async () => {
  const clock = installMockClock();
  const {mockApp, mockExit} = mockApplication();
  const app = {...mockApp, evaluate: vi.fn().mockResolvedValue(4321)};
  let settled = false;
  const stopping = crashElectron(app, async () => undefined).finally(() => {
    settled = true;
  });
  await clock.advance(0);
  expect(settled).toBe(false);
  mockExit();
  await stopping;
  expect(settled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('fails with a bounded error when the main process does not exit', async () => {
  const clock = installMockClock();
  const {mockApp, mockExit, mockKill} = mockApplication();
  const app = {...mockApp, evaluate: vi.fn().mockResolvedValue(4321)};
  mockKill.mockResolvedValue({ok: true});
  const stopping = crashElectron(app, () => new Promise<void>(() => undefined));
  const failure = expect(stopping).rejects.toThrow(
    `Electron main process 4321 or launcher 1234 did not exit within ${CRASH_EXIT_LIMIT_MS} ms after forced stop`,
  );
  await clock.advance(0);
  mockExit();
  await clock.advance(CRASH_EXIT_LIMIT_MS);
  await failure;
  expect(vi.getTimerCount()).toBe(0);
});

it('reports an inability to observe the main process without retrying', async () => {
  const {mockApp} = mockApplication();
  const app = {...mockApp, evaluate: vi.fn().mockResolvedValue(4321)};
  const cause = new Error('waiter failed');
  const terminate = vi.fn(async () => {
    throw cause;
  });
  await expect(crashElectron(app, terminate)).rejects.toThrow(
    'Could not confirm Electron main process 4321 exited',
  );
  expect(terminate).toHaveBeenCalledOnce();
});

it('does not signal a launcher that exited while reading the main PID', async () => {
  const {mockApp, mockExit, mockKill} = mockApplication();
  const app = {
    ...mockApp,
    evaluate: vi.fn(async () => {
      mockExit();
      return 4321;
    }),
  };
  await expect(crashElectron(app)).rejects.toThrow(
    'Electron launcher exited before the crash',
  );
  expect(mockKill).not.toHaveBeenCalled();
});
