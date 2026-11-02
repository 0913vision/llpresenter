import {beforeEach, describe, expect, it, vi} from 'vitest';
import {orderEditorEndpoints} from '@contracts/ipc/orderEditor';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerOrderEditorWindow} from '@main/windows/orderEditor';
import {registerSongEditorWindow} from '@main/windows/songEditor';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, () => unknown>();
  return {
    handlers,
    ipc: {
      handle: vi.fn((channel: string, handler: () => unknown) => {
        if (handlers.has(channel)) throw new Error('Handler registered twice');
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    },
  };
});

vi.mock('electron', () => ({ipcMain: mocks.ipc}));

beforeEach(() => {
  mocks.handlers.clear();
});

describe.each([
  {
    name: 'order editor',
    register: registerOrderEditorWindow,
    open: windowEndpoints.openOrderEditor.channel,
    target: orderEditorEndpoints.target.channel,
  },
  {
    name: 'song editor',
    register: registerSongEditorWindow,
    open: windowEndpoints.openSongEditor.channel,
    target: songEditorWindowEndpoints.target.channel,
  },
])('$name window stub', ({register, open, target}) => {
  it('refuses to open, has no target, and releases its handlers', () => {
    const registration = register({log: recordingLogger()});

    expect(mocks.handlers.get(open)?.()).toEqual({
      ok: false,
      error: {reason: 'not-implemented'},
    });
    expect(mocks.handlers.get(target)?.()).toBeNull();
    registration.dispose();
    expect(mocks.handlers.size).toBe(0);
  });
});
