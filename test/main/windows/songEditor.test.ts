import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerSongEditorWindow} from '@main/windows/songEditor';

const mocks = vi.hoisted(() => {
  class MockWindow {
    readonly webContents = {send: vi.fn()};
    readonly isDestroyed = vi.fn(() => false);
    constructor() {
      created.push(this);
    }
  }
  const created: MockWindow[] = [];
  return {
    handlers: new Map<string, (event: unknown, value: unknown) => unknown>(),
    MockWindow,
    created,
  };
});
vi.mock('electron', () => ({
  BrowserWindow: mocks.MockWindow,
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, value: unknown) => unknown,
    ) => mocks.handlers.set(channel, handler),
    removeHandler: (channel: string) => mocks.handlers.delete(channel),
  },
}));
const SONG = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
beforeEach(() => {
  mocks.handlers.clear();
  mocks.created.length = 0;
});
function setup() {
  const control = new BrowserWindow();
  const mock = mocks.created.at(-1);
  if (mock === undefined) throw new Error('Missing control');
  const send = mock.webContents.send;
  const destroyed = mock.isDestroyed;
  const owner = registerSongEditorWindow({
    control,
    config: {songEditorWindow: undefined, setSongEditorWindow: vi.fn()},
    zoom: {attachControl: vi.fn()},
    mode: 'offscreen',
    log: recordingLogger(),
    hasSong: id => Promise.resolve(id === SONG),
  });
  const open = (target: object) =>
    mocks.handlers.get(windowEndpoints.openSongEditor.channel)?.({}, target);
  const target = () =>
    mocks.handlers.get(songEditorWindowEndpoints.target.channel)?.({}, null);
  return {send, destroyed, owner, open, target};
}

describe('inline song editor requests', () => {
  it('validates a library request and sends its exact target to the control without creating a window', async () => {
    const {open, send, target, owner} = setup();
    expect(target()).toBeNull();
    expect(await open({songId: 'x'})).toMatchObject({ok: false});
    expect(
      await open({songId: '9a1c2a9e-4b7d-4c1a-9e2f-0123456789ab'}),
    ).toMatchObject({ok: false, error: {reason: 'no-such-target'}});
    expect(await open({songId: SONG, block: 2})).toMatchObject({ok: true});
    expect(send).toHaveBeenCalledWith(
      songEditorWindowEndpoints.retarget.channel,
      {songId: SONG, block: 2},
    );
    expect(target()).toEqual({songId: SONG, block: 2});
    expect(mocks.created).toHaveLength(1);
    await owner.dispose();
  });
  it('opens item-owned slides even when their library source was deleted and retargets the same control', async () => {
    const {open, send, owner} = setup();
    const target = {
      songId: '9a1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
      block: 1,
      from: {serviceId: SONG, itemId: SONG},
    };
    expect(await open(target)).toMatchObject({ok: true});
    expect(await open({songId: SONG})).toMatchObject({ok: true});
    expect(send).toHaveBeenCalledTimes(2);
    expect(mocks.created).toHaveLength(1);
    await owner.dispose();
  });
  it('refuses a destroyed control and releases both handlers on dispose', async () => {
    const {open, destroyed, send, owner} = setup();
    destroyed.mockReturnValue(true);
    expect(await open({songId: SONG})).toMatchObject({ok: false});
    expect(send).not.toHaveBeenCalled();
    expect(await owner.close()).toBe(true);
    await owner.dispose();
    expect(mocks.handlers.size).toBe(0);
  });
});
