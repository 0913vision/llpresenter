import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';
import {createGpuSender} from '@main/outputs/ndi/gpuSender';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class Worker extends EventEmitter {
    readonly postMessage = vi.fn<(message: object) => void>();
    readonly kill = vi.fn(() => {
      this.emit('exit', null);
    });
  }
  class Window extends EventEmitter {
    painting = false;
    readonly webContents = Object.assign(new EventEmitter(), {
      setFrameRate: vi.fn(),
      stopPainting: vi.fn(() => {
        this.painting = false;
      }),
      startPainting: vi.fn(() => {
        this.painting = true;
      }),
      isPainting: vi.fn(() => this.painting),
      invalidate: vi.fn(),
      forcefullyCrashRenderer: vi.fn(),
      executeJavaScript: vi.fn(async () => 0),
    });
    readonly setMinimumSize = vi.fn();
    readonly setContentSize = vi.fn();
    readonly destroy = vi.fn();
    readonly isDestroyed = vi.fn(() => false);
    constructor() {
      super();
      windows.push(this);
    }
  }
  const windows: Window[] = [];
  const workers: Worker[] = [];
  const fork = vi.fn(() => {
    const worker = new Worker();
    workers.push(worker);
    return worker;
  });
  const gpuStatus = vi.fn(() => ({gpu_compositing: 'enabled'}));
  return {Window, windows, workers, fork, gpuStatus};
});
vi.mock('electron', () => ({
  app: {getGPUFeatureStatus: mocks.gpuStatus},
  BrowserWindow: mocks.Window,
  utilityProcess: {fork: mocks.fork},
}));
vi.mock('@main/base/renderers/page', () => ({
  blockNavigation: vi.fn(),
  startLoading: vi.fn(async () => undefined),
}));

const FULL = {x: 0, y: 0, width: 1920, height: 1080};

function texture() {
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(0xabcn);
  return {
    textureInfo: {handle: {ntHandle: handle}, pixelFormat: 'bgra'},
    release: vi.fn(),
  };
}

function setup(options: {pixels?: boolean} = {}) {
  const fallback = vi.fn();
  const runtimeMissing = vi.fn();
  const live = vi.fn();
  const pixels = vi.fn((_data: Uint8Array, release: () => void) => release());
  const sender = createGpuSender(
    fullScreenScreen({
      method: 'capture',
      target: 'ndi',
      ndi: {hardwareAcceleration: true},
    }),
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {
      log: recordingLogger(),
      fallback,
      runtimeMissing,
      live,
      ...(options.pixels === true ? {pixels} : {}),
    },
  );
  const win = mocks.windows.at(-1);
  if (!win) throw new Error('Missing window');
  const worker = () => {
    const found = mocks.workers.at(-1);
    if (!found) throw new Error('Missing worker');
    return found;
  };
  const paint = (event: object, dirty = FULL) =>
    win.webContents.emit('paint', event, dirty);
  const frames = () =>
    worker().postMessage.mock.calls.filter(
      ([message]) => 'type' in message && message.type === 'frame',
    );
  return {
    sender,
    win,
    worker,
    paint,
    frames,
    fallback,
    runtimeMissing,
    live,
    pixels,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.windows.length = 0;
  mocks.workers.length = 0;
  mocks.fork.mockClear();
  mocks.gpuStatus.mockReset();
  mocks.gpuStatus.mockReturnValue({gpu_compositing: 'enabled'});
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('falls back without a utility when GPU compositing is off', () => {
  mocks.gpuStatus.mockReturnValue({gpu_compositing: 'disabled_software'});
  const {sender, fallback} = setup();
  sender.showCapture(FULL);
  expect(mocks.fork).not.toHaveBeenCalled();
  expect(fallback).toHaveBeenCalledWith('GPU compositing is unavailable');
});

it('falls back when the utility never gets ready', () => {
  const {sender, fallback} = setup();
  sender.showCapture(FULL);
  vi.advanceTimersByTime(4999);
  expect(fallback).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(fallback).toHaveBeenCalledWith('GPU utility startup timeout');
});

it('sends a full shared texture once ready and releases it when the copy is done', () => {
  const {sender, win, worker, paint, frames, fallback} = setup();
  sender.showCapture(FULL);
  worker().emit('message', {type: 'ready'});
  expect(win.webContents.startPainting).toHaveBeenCalled();
  const first = texture();
  paint({texture: first});
  expect(frames()).toHaveLength(1);
  expect(frames()[0]?.[0]).toMatchObject({
    type: 'frame',
    handle: 'abc',
    dirty: FULL,
  });
  worker().emit('message', {type: 'copied'});
  expect(first.release).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(10_000);
  expect(fallback).not.toHaveBeenCalled();
});

it('falls back when a copy never comes back', () => {
  const {sender, worker, paint, fallback} = setup();
  sender.showCapture(FULL);
  worker().emit('message', {type: 'ready'});
  paint({texture: texture()});
  vi.advanceTimersByTime(5000);
  expect(fallback).toHaveBeenCalledWith('GPU copy timeout');
});

it('releases a texture that comes before the utility is ready', () => {
  const {sender, paint, frames} = setup();
  sender.showCapture(FULL);
  const early = texture();
  paint({texture: early});
  expect(early.release).toHaveBeenCalledOnce();
  expect(frames()).toHaveLength(0);
});

it('falls back when textures stop arriving after the first one', () => {
  const {sender, worker, paint, fallback} = setup();
  sender.showCapture(FULL);
  worker().emit('message', {type: 'ready'});
  paint({texture: texture()});
  worker().emit('message', {type: 'copied'});
  paint({});
  vi.advanceTimersByTime(2000);
  paint({});
  expect(fallback).toHaveBeenCalledWith('shared textures stopped arriving');
});

it('falls back once when the utility exits, and reports a missing NDI runtime apart', () => {
  const first = setup();
  first.sender.showCapture(FULL);
  first.worker().emit('exit', 3);
  expect(first.fallback).toHaveBeenCalledExactlyOnceWith('utility exited 3');

  const second = setup();
  second.sender.showCapture(FULL);
  second
    .worker()
    .emit('message', {type: 'error', message: 'NDI_RUNTIME_MISSING'});
  expect(second.runtimeMissing).toHaveBeenCalledOnce();
  expect(second.fallback).not.toHaveBeenCalled();
});

it('releases the texture on its way when it stops and destroys the window once the utility is gone', () => {
  const {sender, win, worker, paint} = setup();
  sender.showCapture(FULL);
  worker().emit('message', {type: 'ready'});
  const sending = texture();
  paint({texture: sending});
  sender.destroy();
  expect(worker().kill).toHaveBeenCalled();
  expect(sending.release).toHaveBeenCalledOnce();
  expect(win.destroy).toHaveBeenCalledOnce();
});

it('hands a probe frame to the bitmap output and takes the next copy only after it is released', () => {
  const {sender, worker, paint, frames, pixels} = setup({pixels: true});
  sender.showCapture(FULL);
  worker().emit('message', {type: 'ready'});
  const first = texture();
  paint({texture: first});
  worker().emit('message', {type: 'copied'});
  expect(first.release).not.toHaveBeenCalled();
  worker().emit('message', {
    type: 'pixels',
    data: new Uint8Array(1920 * 1080 * 4),
  });
  expect(pixels).toHaveBeenCalledOnce();
  expect(first.release).toHaveBeenCalledOnce();
  paint({texture: texture()}, {x: 0, y: 0, width: 10, height: 10});
  expect(frames()).toHaveLength(2);
});
