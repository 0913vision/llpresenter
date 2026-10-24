import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../test/temp-dir';

const electron = vi.hoisted(() => ({
  app: {
    setPath: vi.fn<(name: string, path: string) => void>(),
    getPath: vi.fn<(name: string) => string>(),
    isPackaged: true,
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
    exit: vi.fn<(code: number) => void>(),
    on: vi.fn(),
    whenReady: vi.fn(() => new Promise<never>(() => undefined)),
  },
  dialog: {showErrorBox: vi.fn()},
}));

vi.mock('electron', () => electron);

const ABSOLUTE =
  process.platform === 'win32' ? 'D:\\llp-dev\\qa' : '/llp-dev/qa';
const BAD_ENVIRONMENT_EXIT_CODE = 1;

async function loadMain(): Promise<void> {
  const events = ['uncaughtException', 'unhandledRejection'] as const;
  const before = events.map(event => new Set(process.listeners(event)));
  onTestFinished(() => {
    events.forEach((event, index) => {
      for (const listener of process.listeners(event)) {
        if (!before[index]?.has(listener)) process.off(event, listener);
      }
    });
  });
  vi.resetModules();
  await import('./index');
}

beforeEach(async () => {
  const dir = await makeTempDir();
  electron.app.getPath.mockReturnValue(dir);
  electron.app.setPath.mockReset();
  electron.app.exit.mockReset();
  electron.app.requestSingleInstanceLock.mockClear();
});

async function mainLog(): Promise<string> {
  const dir = electron.app.getPath('userData');
  return readFile(join(dir, 'logs', 'main.log'), 'utf8');
}

describe('main entry with LLP_USER_DATA', () => {
  it('quits with a logged error and no dialog when the path is relative', async () => {
    vi.stubEnv('LLP_USER_DATA', 'D:llp-devqa');
    await loadMain();
    await vi.waitFor(() => {
      expect(electron.app.exit).toHaveBeenCalledWith(BAD_ENVIRONMENT_EXIT_CODE);
    });
    expect(electron.app.setPath).not.toHaveBeenCalled();
    expect(electron.app.requestSingleInstanceLock).not.toHaveBeenCalled();
    expect(electron.dialog.showErrorBox).not.toHaveBeenCalled();
    expect(await mainLog()).toContain(
      'LLP_USER_DATA is not a usable app data folder',
    );
  });

  it('quits the same way when Electron refuses the path', async () => {
    vi.stubEnv('LLP_USER_DATA', ABSOLUTE);
    electron.app.setPath.mockImplementation(() => {
      throw new Error('Failed to set path');
    });
    await loadMain();
    await vi.waitFor(() => {
      expect(electron.app.exit).toHaveBeenCalledWith(BAD_ENVIRONMENT_EXIT_CODE);
    });
    expect(await mainLog()).toContain('Failed to set path');
  });

  it('moves the folder and starts with a usable path', async () => {
    vi.stubEnv('LLP_USER_DATA', ABSOLUTE);
    await loadMain();
    expect(electron.app.setPath).toHaveBeenCalledWith('userData', ABSOLUTE);
    expect(electron.app.requestSingleInstanceLock).toHaveBeenCalled();
    expect(electron.app.exit).not.toHaveBeenCalled();
  });
});
