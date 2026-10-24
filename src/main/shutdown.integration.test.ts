import {describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {makeTempDir} from '../../test/temp-dir';
import {recordingLogger} from './displays/testing';
import {ShutdownCoordinator} from './shutdown';

const SHORT_LIMIT_MS = 50;

const electron = vi.hoisted(() => {
  // NOTE(0913vision): One Electron-like app for every module, so a quit hook
  // that any module installs runs in the same quit as the coordinator's. A
  // quit during a quit event is ignored, and after a prevented one only a
  // quit from a later task gets through (qa bug M1-11).
  const quitListeners: Array<(event: {preventDefault(): void}) => void> = [];
  const state = {quitted: false, quitting: false};
  const app = {
    on: (
      event: string,
      listener: (event: {preventDefault(): void}) => void,
    ) => {
      if (event === 'before-quit') quitListeners.push(listener);
    },
    removeListener: () => undefined,
    quit: () => {
      if (state.quitting) return;
      state.quitting = true;
      const event = {
        prevented: false,
        preventDefault: () => {
          event.prevented = true;
        },
      };
      for (const listener of quitListeners) listener(event);
      if (!event.prevented) {
        state.quitted = true;
        return;
      }
      setImmediate(() => {
        state.quitting = false;
      });
    },
  };
  const ipcHandlers = new Map<
    string,
    (event: unknown, value: unknown) => void
  >();
  const ipcMain = {
    handle: () => undefined,
    on: (channel: string, handler: (event: unknown, value: unknown) => void) =>
      ipcHandlers.set(channel, handler),
    removeHandler: () => undefined,
    removeAllListeners: () => undefined,
  };
  return {app, ipcMain, ipcHandlers, state};
});

vi.mock('electron', () => ({app: electron.app, ipcMain: electron.ipcMain}));
vi.mock('./uiState/fileIo', () => ({
  fileIo: {
    read: () => Promise.resolve(null),
    write: () => new Promise<void>(() => undefined),
  },
}));

const {registerUiState} = await import('./uiState/register');

describe('shutdown with the real UI state registration', () => {
  it('quits after the save limit when writing app.json never ends', async () => {
    const log = recordingLogger();
    const ui = await registerUiState(`${await makeTempDir()}/app.json`, log);
    electron.ipcHandlers.get(Channels.uiLayoutSet)?.(
      {},
      {sizeClass: 'narrow', left: 220, right: 360},
    );
    const shutdown = new ShutdownCoordinator({
      app: electron.app,
      log,
      saveLimitMs: SHORT_LIMIT_MS,
      logFlushLimitMs: SHORT_LIMIT_MS,
    });
    shutdown.add({name: 'save the UI state', run: () => ui.dispose()});
    electron.app.quit();
    await vi.waitFor(() => expect(electron.state.quitted).toBe(true));
    expect(log.messages('error')).toContain(
      'saving before quitting took too long; quitting anyway',
    );
  });
});
