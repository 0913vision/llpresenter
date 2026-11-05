import {BrowserWindow} from 'electron';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {slidesEditorEndpoints} from '@contracts/ipc/slidesEditor';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerSlidesEditorWindow} from '@main/windows/slidesEditor';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockWindow extends EventEmitter {
    destroyed = false;
    webContents = {send: vi.fn()};
    getNormalBounds = () => ({x: 0, y: 0, width: 1280, height: 820});
    isDestroyed = () => this.destroyed;
    isMinimized = () => true;
    focus = vi.fn();
    restore = vi.fn();
    destroy = (): void => {
      this.destroyed = true;
      this.emit('closed');
    };
  }
  const ipc = Object.assign(new EventEmitter(), {
    handlers: new Map<string, (event: unknown, value: unknown) => unknown>(),
    handle(
      channel: string,
      handler: (event: unknown, value: unknown) => unknown,
    ) {
      this.handlers.set(channel, handler);
    },
    removeHandler(channel: string) {
      this.handlers.delete(channel);
    },
  });
  return {
    MockWindow,
    ipc,
    created: new Array<MockWindow>(),
    options: new Array<unknown>(),
    confirm: vi.fn(async () => true),
    dispose: vi.fn(),
  };
});
vi.mock('electron', () => ({
  app: {quit: vi.fn()},
  BrowserWindow: mocks.MockWindow,
  ipcMain: mocks.ipc,
  screen: {
    getDisplayMatching: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
  },
}));
vi.mock('@main/windows/editorWindow', () => ({
  createEditorWindow: (options: unknown) => {
    const win = new mocks.MockWindow();
    mocks.created.push(win);
    mocks.options.push(options);
    return win;
  },
}));
vi.mock('@main/windows/controlClose', () => ({
  registerControlClose: () => ({
    confirmClose: mocks.confirm,
    dispose: mocks.dispose,
  }),
}));

const target = {
  serviceId: '00000000-0000-4000-8000-000000000001',
  itemId: '00000000-0000-4000-8000-000000000002',
};
afterEach(() => {
  mocks.created.length = 0;
  mocks.options.length = 0;
  mocks.ipc.handlers.clear();
  mocks.ipc.removeAllListeners();
  mocks.confirm.mockReset().mockResolvedValue(true);
});

describe('slides editor window owner', () => {
  it('validates targets, reuses one offscreen window, and guards closing and disposal', async () => {
    const owner = registerSlidesEditorWindow({
      control: new BrowserWindow(),
      zoom: {attachControl: vi.fn()},
      mode: 'offscreen',
      log: recordingLogger(),
      hasItem: async requested => requested.itemId === target.itemId,
    });
    const open = (value: unknown) =>
      mocks.ipc.handlers.get(slidesEditorEndpoints.open.channel)?.({}, value);
    expect(await open({})).toMatchObject({ok: false});
    expect(await open({...target, itemId: target.serviceId})).toMatchObject({
      ok: false,
      error: {reason: 'no-such-target'},
    });
    expect(await open(target)).toMatchObject({ok: true});
    expect(await open(target)).toMatchObject({ok: true});
    expect(mocks.created).toHaveLength(1);
    expect(mocks.options[0]).toMatchObject({
      mode: 'offscreen',
      page: {query: {window: 'slides'}},
    });
    expect(mocks.created[0]?.focus).not.toHaveBeenCalled();
    expect(mocks.created[0]?.webContents.send).toHaveBeenCalledWith(
      slidesEditorEndpoints.retarget.channel,
      target,
    );
    mocks.confirm.mockResolvedValueOnce(false);
    expect(await owner.close()).toBe(false);
    expect(mocks.created[0]?.destroyed).toBe(false);
    await owner.dispose();
    expect(mocks.created[0]?.destroyed).toBe(true);
    expect(mocks.ipc.handlers.size).toBe(0);
    expect(mocks.ipc.listenerCount(slidesEditorEndpoints.saved.channel)).toBe(
      0,
    );
  });
  it('forwards validated save history only from the editor into the control window', async () => {
    const control = new BrowserWindow();
    const owner = registerSlidesEditorWindow({
      control,
      zoom: {attachControl: vi.fn()},
      mode: 'normal',
      log: recordingLogger(),
      hasItem: async () => true,
    });
    await mocks.ipc.handlers.get(slidesEditorEndpoints.open.channel)?.(
      {},
      target,
    );
    const service = {
      format: 'llservice',
      schemaVersion: 1,
      id: target.serviceId,
      name: 'Service',
      date: '2026-11-05T11:00',
      order: [],
    };
    const value = {before: service, after: service};
    mocks.ipc.emit(
      slidesEditorEndpoints.saved.channel,
      {sender: control.webContents},
      value,
    );
    expect(control.webContents.send).not.toHaveBeenCalled();
    const sender = mocks.created[0]?.webContents;
    mocks.ipc.emit(slidesEditorEndpoints.saved.channel, {sender}, value);
    expect(control.webContents.send).toHaveBeenCalledWith(
      slidesEditorEndpoints.savedInControl.channel,
      value,
    );
    await owner.dispose();
  });
});
