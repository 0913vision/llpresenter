import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {orderEditorEndpoints} from '@contracts/ipc/orderEditor';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {registerOrderEditorWindow} from '@main/windows/orderEditor';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const listeners = new Map<string, (...args: unknown[]) => void>();
  class MockWindow {
    readonly closed: Array<() => void> = [];
    readonly webContents = {
      send: vi.fn(),
      isDestroyed: () => false,
      getZoomFactor: () => 1,
      executeJavaScript: vi.fn(() =>
        Promise.resolve(
          JSON.stringify({left: 0, top: 60, right: 300, bottom: 960}),
        ),
      ),
    };
    readonly destroy = vi.fn();
    readonly focus = vi.fn();
    readonly on = vi.fn();
    readonly removeListener = vi.fn();
    isDestroyed = () => false;
    isMinimized = () => false;
    isMaximized = () => false;
    getNormalBounds = () => ({x: 1, y: 2, width: 3, height: 4});
    getBounds = () => ({x: 0, y: 0, width: 1920, height: 1040});
    getContentBounds = () => ({x: 0, y: 30, width: 1920, height: 1010});
    once = (event: string, listener: () => void) => {
      if (event === 'closed') this.closed.push(listener);
    };
  }
  return {
    handlers,
    listeners,
    MockWindow,
    ipc: {
      handle: vi.fn((channel: string, handler: () => unknown) => {
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
      on: vi.fn((channel: string, listener: () => void) => {
        listeners.set(channel, listener);
      }),
      removeListener: vi.fn((channel: string) => listeners.delete(channel)),
    },
    created: new Array<{
      bounds: unknown;
      window: InstanceType<typeof MockWindow>;
    }>(),
    confirmClose: vi.fn(() => Promise.resolve(true)),
  };
});

vi.mock('electron', () => ({
  app: {quit: vi.fn()},
  BrowserWindow: mocks.MockWindow,
  ipcMain: mocks.ipc,
  screen: {
    getDisplayMatching: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1040},
    }),
  },
}));
vi.mock('@main/windows/editorWindow', () => ({
  createEditorWindow: (options: {bounds: unknown}) => {
    const window = new mocks.MockWindow();
    mocks.created.push({bounds: options.bounds, window});
    return window;
  },
}));
vi.mock('@main/windows/controlClose', () => ({
  registerControlClose: () => ({
    confirmClose: mocks.confirmClose,
    dispose: vi.fn(),
  }),
}));

const OPEN = windowEndpoints.openOrderEditor.channel;
const TARGET = {
  serviceId: '30000000-0000-4000-8000-000000000001',
  itemId: '40000000-0000-4000-8000-000000000001',
};
const OTHER = {...TARGET, itemId: '40000000-0000-4000-8000-000000000002'};
const PLACEMENT = {x: 5, y: 6, width: 700, height: 500, maximized: false};

function setup(saved?: {slideSize: number}) {
  const config = {
    orderEditorWindow:
      saved === undefined ? undefined : {...PLACEMENT, ...saved},
    setOrderEditorWindow: vi.fn(),
  };
  const control = new BrowserWindow();
  const registration = registerOrderEditorWindow({
    control,
    config,
    zoom: {attachControl: vi.fn()},
    mode: 'offscreen',
    log: recordingLogger(),
  });
  const open = (value: unknown) => mocks.handlers.get(OPEN)?.({}, value);
  return {registration, config, open, control};
}

function created(index = 0) {
  const entry = mocks.created[index];
  if (entry === undefined) throw new Error('Missing order editor window');
  return entry;
}

beforeEach(() => {
  mocks.handlers.clear();
  mocks.listeners.clear();
  mocks.created.length = 0;
  mocks.confirmClose.mockClear();
});

describe('registerOrderEditorWindow', () => {
  it('opens beside the library and answers the target', async () => {
    const {open} = setup();

    expect(await open(TARGET)).toEqual({ok: true, value: undefined});
    expect(mocks.created).toHaveLength(1);
    expect(created().bounds).toEqual({
      x: 300,
      y: 90,
      width: 1100,
      height: 900,
    });
    expect(
      await mocks.handlers.get(orderEditorEndpoints.target.channel)?.(),
    ).toEqual(TARGET);
  });

  it('opens one window for two opens that arrive before the first is placed', async () => {
    const {open, control} = setup();
    let release: (reply: string) => void = () => undefined;
    vi.spyOn(control.webContents, 'executeJavaScript').mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          release = resolve;
        }),
    );
    const first = open(TARGET);
    const second = open(OTHER);
    release(JSON.stringify({left: 0, top: 60, right: 300, bottom: 960}));
    await Promise.all([first, second]);

    expect(mocks.created).toHaveLength(1);
    expect(
      await mocks.handlers.get(orderEditorEndpoints.target.channel)?.(),
    ).toEqual(OTHER);
    mocks.created[0]?.window.closed.forEach(listener => listener());
    await open(TARGET);
    expect(mocks.created).toHaveLength(2);
  });

  it('retargets the open window instead of opening another', async () => {
    const {open} = setup();
    await open(TARGET);
    await open(OTHER);

    expect(mocks.created).toHaveLength(1);
    expect(created().window.webContents.send).toHaveBeenCalledWith(
      orderEditorEndpoints.retarget.channel,
      OTHER,
    );
  });

  it('refuses a malformed target without opening a window', async () => {
    const {open} = setup();

    expect(await open({serviceId: 'x'})).toEqual({
      ok: false,
      error: {reason: 'failed'},
    });
    expect(mocks.created).toHaveLength(0);
  });

  it('forgets the target when the window closes and opens a new one', async () => {
    const {open} = setup();
    await open(TARGET);
    created().window.closed.forEach(listener => listener());

    expect(
      await mocks.handlers.get(orderEditorEndpoints.target.channel)?.(),
    ).toBeNull();
    await open(OTHER);
    expect(mocks.created).toHaveLength(2);
  });

  it('keeps a valid slide size with the window bounds and drops others', async () => {
    const {open, config} = setup({slideSize: 240});
    await open(TARGET);
    const set = mocks.listeners.get(orderEditorEndpoints.setSlideSize.channel);

    set?.({}, 320);
    set?.({}, 0);
    set?.({}, 'wide');

    expect(config.setOrderEditorWindow).toHaveBeenCalledTimes(1);
    expect(config.setOrderEditorWindow).toHaveBeenCalledWith({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      maximized: false,
      slideSize: 320,
    });
    expect(
      await mocks.handlers.get(orderEditorEndpoints.slideSize.channel)?.(),
    ).toBe(240);
  });

  it('closes the window after the flush handshake and releases its IPC on dispose', async () => {
    const {open, registration} = setup();
    await open(TARGET);

    await registration.dispose();

    expect(mocks.confirmClose).toHaveBeenCalledOnce();
    expect(created().window.destroy).toHaveBeenCalledOnce();
    expect(mocks.handlers.size).toBe(0);
    expect(mocks.listeners.size).toBe(0);
  });

  it('keeps the window and its IPC when the flush is refused', async () => {
    const {open, registration} = setup();
    await open(TARGET);
    mocks.confirmClose.mockResolvedValueOnce(false);

    await registration.dispose();

    expect(created().window.destroy).not.toHaveBeenCalled();
    expect(mocks.handlers.has(OPEN)).toBe(true);
  });
});
