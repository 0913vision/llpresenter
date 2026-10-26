import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {recordingLogger} from '../displays/testing';
import {registerProblemChannels} from './problemChannels';
import {SaveFailures} from './saveFailures';

const electron = vi.hoisted(() => ({
  handlers: new Map<string, () => unknown>(),
  listeners: new Map<string, () => void>(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: electron.send},
      },
    ],
  },
  ipcMain: {
    handle: (channel: string, handler: () => unknown) => {
      electron.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      electron.handlers.delete(channel);
    },
    on: (channel: string, listener: () => void) => {
      electron.listeners.set(channel, listener);
    },
    removeListener: (channel: string) => {
      electron.listeners.delete(channel);
    },
  },
}));

beforeEach(() => {
  electron.handlers.clear();
  electron.listeners.clear();
  electron.send.mockClear();
});

describe('problem channels', () => {
  it('lists, pushes, and retries the waiting saves, and removes everything on dispose', async () => {
    const log = recordingLogger();
    const saves = new SaveFailures({log});
    const remove = registerProblemChannels(saves, log);
    expect(electron.handlers.get(Channels.appProblemList)?.()).toEqual([]);
    const retry = vi.fn(() => Promise.resolve());
    saves.waiting({file: 'a.json', name: 'a.json', retry});
    const problem = {kind: 'save-failed', name: 'a.json', count: 1};
    expect(electron.send).toHaveBeenCalledExactlyOnceWith(
      Channels.appProblem,
      problem,
    );
    expect(electron.handlers.get(Channels.appProblemList)?.()).toEqual([
      problem,
    ]);
    electron.listeners.get(Channels.appProblemRetrySaves)?.();
    await vi.waitFor(() => expect(retry).toHaveBeenCalledOnce());
    remove();
    expect(electron.handlers.size).toBe(0);
    expect(electron.listeners.size).toBe(0);
    saves.saved('a.json');
    expect(electron.send).toHaveBeenCalledOnce();
    saves.dispose();
  });
});
