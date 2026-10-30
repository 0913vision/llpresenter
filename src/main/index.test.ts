import {readFileSync} from 'node:fs';
import type * as FsPromises from 'node:fs/promises';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {MEDIA_SCHEME} from '@contracts/ipc/media';
import {makeTempDir} from '../../test/temp-dir';

const WRITE_DELAY_MS = 50;

// NOTE(0913vision): Each test imports the whole main process afresh, which
// takes several seconds under coverage on a busy machine.
const ENTRY_TEST_TIMEOUT_MS = 30_000;

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
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
    unhandle: vi.fn(),
  },
}));

vi.mock('electron', () => electron);

// NOTE(0913vision): Log writes are held back a little, so a quit that didn't
// wait for the flush would find the log still empty.
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    appendFile: async (...args: Parameters<typeof actual.appendFile>) => {
      await new Promise(resolve => setTimeout(resolve, WRITE_DELAY_MS));
      return actual.appendFile(...args);
    },
  };
});

const ABSOLUTE = process.platform === 'win32' ? 'C:\\data\\qa' : '/data/qa';
const BAD_ENVIRONMENT_EXIT_CODE = 1;
// NOTE(0913vision): The quit waits for the log flush, which takes over a
// second under coverage on a CI runner; the default 1 s wait failed there.
const EXIT_WAIT = {timeout: ENTRY_TEST_TIMEOUT_MS};

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

let logAtExit: string | null = null;

function readMainLog(): string {
  const dir = electron.app.getPath('userData');
  try {
    return readFileSync(join(dir, 'logs', 'main.log'), 'utf8');
  } catch {
    return '';
  }
}

beforeEach(async () => {
  const dir = await makeTempDir();
  logAtExit = null;
  electron.app.getPath.mockReturnValue(dir);
  electron.app.setPath.mockReset();
  electron.app.exit.mockReset();
  electron.app.exit.mockImplementation(() => {
    logAtExit = readMainLog();
  });
  electron.app.requestSingleInstanceLock.mockClear();
});

describe(
  'main entry with LLP_USER_DATA',
  {timeout: ENTRY_TEST_TIMEOUT_MS},
  () => {
    it('quits with a logged error and no dialog when the path is relative', async () => {
      vi.stubEnv('LLP_USER_DATA', 'C:dataqa');
      await loadMain();
      await vi.waitFor(() => {
        expect(electron.app.exit).toHaveBeenCalledWith(
          BAD_ENVIRONMENT_EXIT_CODE,
        );
      }, EXIT_WAIT);
      expect(electron.app.setPath).not.toHaveBeenCalled();
      expect(electron.app.requestSingleInstanceLock).not.toHaveBeenCalled();
      expect(electron.dialog.showErrorBox).not.toHaveBeenCalled();
      expect(logAtExit).toContain(
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
        expect(electron.app.exit).toHaveBeenCalledWith(
          BAD_ENVIRONMENT_EXIT_CODE,
        );
      }, EXIT_WAIT);
      expect(logAtExit).toContain('Failed to set path');
    });

    it('moves the folder and starts with a usable path', async () => {
      vi.stubEnv('LLP_USER_DATA', ABSOLUTE);
      await loadMain();
      expect(electron.app.setPath).toHaveBeenCalledWith('userData', ABSOLUTE);
      expect(electron.app.requestSingleInstanceLock).toHaveBeenCalled();
      expect(electron.app.exit).not.toHaveBeenCalled();
    });

    it('registers the media scheme before the app is ready', async () => {
      vi.stubEnv('LLP_USER_DATA', ABSOLUTE);
      await loadMain();
      expect(
        electron.protocol.registerSchemesAsPrivileged,
      ).toHaveBeenCalledWith([expect.objectContaining({scheme: MEDIA_SCHEME})]);
    });
  },
);
