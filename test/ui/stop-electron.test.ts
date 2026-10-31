import {ChildProcess} from 'node:child_process';
import {expect, it, vi} from 'vitest';
import {killProcessTree} from '../../scripts/process-tree.mts';
import {installMockClock} from '../mock-clock';
import {CLOSE_GRACE_MS, stopElectron} from './stop-electron';

vi.mock('../../scripts/process-tree.mts', () => ({killProcessTree: vi.fn()}));

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
