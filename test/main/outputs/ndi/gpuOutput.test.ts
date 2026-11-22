import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createGpuOutput} from '@main/outputs/ndi/gpuOutput';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';
import type {BitmapSender} from '@main/outputs/ndi/output';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  const windows: Window[] = [];
  const workers: Worker[] = [];
  const status = {gpu: 'enabled', autoFrame: true};
  const full = {x: 0, y: 0, width: 1920, height: 1080};
  const texture = () => ({
    textureInfo: {handle: {ntHandle: Buffer.alloc(8)}, pixelFormat: 'bgra'},
    release: vi.fn(),
  });
  class Worker extends EventEmitter {
    postMessage = vi.fn();
    kill = vi.fn();
  }
  class Window extends EventEmitter {
    painting = true;
    textures: Array<ReturnType<typeof texture>> = [];
    constructor() {
      super();
      windows.push(this);
    }
    webContents = Object.assign(new EventEmitter(), {
      setFrameRate: vi.fn(),
      isPainting: vi.fn(() => this.painting),
      stopPainting: vi.fn(() => {
        this.painting = false;
      }),
      startPainting: vi.fn(() => {
        this.painting = true;
        if (status.autoFrame) this.paintTexture();
      }),
      invalidate: vi.fn(() => this.webContents.emit('paint', {}, full)),
      executeJavaScript: vi.fn(async () => 0),
      forcefullyCrashRenderer: vi.fn(),
    });
    paintTexture(dirty = full, value = texture()) {
      this.textures.push(value);
      this.webContents.emit('paint', {texture: value}, dirty);
      return value;
    }
    setMinimumSize = vi.fn();
    setContentSize = vi.fn();
    isDestroyed = vi.fn(() => false);
    destroy = vi.fn();
  }
  return {Worker, Window, workers, windows, status, texture, full};
});
vi.mock('electron', () => ({
  BrowserWindow: mocks.Window,
  app: {getGPUFeatureStatus: () => ({gpu_compositing: mocks.status.gpu})},
  utilityProcess: {
    fork: () => {
      const worker = new mocks.Worker();
      mocks.workers.push(worker);
      return worker;
    },
  },
}));
vi.mock('@main/base/page', () => ({
  blockNavigation: vi.fn(),
  preloadPath: '',
  startLoading: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.windows.length = 0;
  mocks.workers.length = 0;
  mocks.status.gpu = 'enabled';
  mocks.status.autoFrame = true;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setup() {
  const failure = vi.fn();
  const acceleration = vi.fn();
  const sink = {
    configure: vi.fn(),
    prepare: vi.fn(),
    requestFrame: vi.fn(),
    contentSize: vi.fn(() => ({width: 1920, height: 1080})),
    setAlwaysOnTop: vi.fn(),
    showFullScreen: vi.fn(),
    showWindowed: vi.fn(),
    prepareForMonitorRemoval: vi.fn(),
    bringToFront: vi.fn(),
    bounds: vi.fn(() => null),
    reload: vi.fn(async () => undefined),
    crashRenderer: vi.fn(),
    ping: vi.fn(async () => undefined),
    showCapture: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
    setGpuInput: vi.fn(),
    submitGpuPixels: vi.fn((_data: Uint8Array, sent: () => void) => sent()),
  } satisfies BitmapSender;
  const bitmap = vi.fn(() => sink);
  const screen = fullScreenScreen({method: 'capture', target: 'ndi'});
  const handle = createGpuOutput(
    screen,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {
      options: {
        log: recordingLogger(),
        onFailure: failure,
        onAcceleration: acceleration,
      },
      bitmap,
    },
  );
  const win = mocks.windows[0];
  if (!win) throw new Error('Missing GPU window');
  return {handle, failure, screen, acceleration, bitmap, sink, win};
}
function worker(index = 0) {
  const value = mocks.workers[index];
  if (!value) throw new Error('Missing worker');
  return value;
}
function start(handle: ReturnType<typeof setup>['handle']) {
  handle.showCapture(mocks.full);
}
function ready(index = 0) {
  worker(index).emit('message', {type: 'ready'});
}

describe('GPU sender lifecycle', () => {
  it('stops initial painting until the sender is ready and delivers a static frame', () => {
    const {handle, win, bitmap, acceleration} = setup();
    expect(win.webContents.stopPainting).toHaveBeenCalledOnce();
    expect(win.painting).toBe(false);
    start(handle);
    const stale = win.paintTexture();
    expect(stale.release).toHaveBeenCalledOnce();
    expect(worker().postMessage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(win.webContents.startPainting).not.toHaveBeenCalled();
    ready();
    expect(win.webContents.startPainting).toHaveBeenCalledOnce();
    expect(worker().postMessage).toHaveBeenCalledWith(
      expect.objectContaining({type: 'frame', dirty: mocks.full}),
    );
    worker().emit('message', {type: 'copied'});
    worker().emit('message', {type: 'live'});
    expect(acceleration).toHaveBeenLastCalledWith({
      ndiAcceleration: 'hardware',
    });
    vi.advanceTimersByTime(10_000);
    expect(bitmap).not.toHaveBeenCalled();
    expect(win.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('restarts capture for a requested frame only after ready, without invalidating', () => {
    const {handle, win} = setup();
    start(handle);
    handle.requestFrame();
    expect(win.webContents.startPainting).not.toHaveBeenCalled();
    ready();
    worker().emit('message', {type: 'copied'});
    handle.requestFrame();
    expect(win.webContents.startPainting).toHaveBeenCalledTimes(2);
    expect(win.webContents.stopPainting).toHaveBeenCalledTimes(3);
    expect(win.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('restarts capture after a sender settings change and a hide/show', () => {
    const {handle, win, screen} = setup();
    start(handle);
    ready();
    worker().emit('message', {type: 'copied'});
    handle.configure({...screen, ndi: {...screen.ndi, sourceName: 'Changed'}});
    expect(win.painting).toBe(false);
    expect(win.webContents.startPainting).toHaveBeenCalledTimes(1);
    ready(1);
    expect(win.webContents.startPainting).toHaveBeenCalledTimes(2);
    worker(1).emit('message', {type: 'copied'});
    handle.hide();
    expect(win.painting).toBe(false);
    start(handle);
    ready(2);
    expect(win.webContents.startPainting).toHaveBeenCalledTimes(3);
    expect(win.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('returns from bitmap to GPU on a static screen only after a full frame is sent', () => {
    const {handle, bitmap, sink, acceleration} = setup();
    start(handle);
    worker().emit('message', {type: 'error', message: 'GPU failed'});
    expect(bitmap).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5000);
    const probe = mocks.windows[1];
    if (!probe) throw new Error('Missing probe');
    expect(probe.painting).toBe(false);
    ready(1);
    expect(worker(1).postMessage).toHaveBeenCalledWith(
      expect.objectContaining({type: 'frame', dirty: mocks.full}),
    );
    worker(1).emit('message', {
      type: 'pixels',
      data: new Uint8Array(1920 * 1080 * 4),
    });
    expect(sink.submitGpuPixels).toHaveBeenCalledOnce();
    expect(acceleration).toHaveBeenLastCalledWith({
      ndiAcceleration: 'hardware',
    });
    expect(probe.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });

  it.each([
    'utility error',
    'utility exit',
    'startup timeout',
    'missing texture',
    'copy timeout',
    'bad handle',
    'bad format',
    'compositing disabled',
    'textures stop',
  ])('falls back on %s', reason => {
    const {handle, bitmap, win} = setup();
    if (reason === 'compositing disabled') {
      mocks.status.gpu = 'disabled_software';
    }
    if (
      reason === 'missing texture' ||
      reason === 'bad handle' ||
      reason === 'bad format'
    ) {
      mocks.status.autoFrame = false;
    }
    start(handle);
    if (reason === 'utility error') {
      worker().emit('message', {type: 'error', message: 'failed'});
    }
    if (reason === 'utility exit') worker().emit('exit', 1);
    if (reason === 'startup timeout') vi.advanceTimersByTime(5000);
    if (reason === 'missing texture') {
      ready();
      vi.advanceTimersByTime(5000);
    }
    if (reason === 'copy timeout') {
      ready();
      vi.advanceTimersByTime(5000);
    }
    if (reason === 'bad handle' || reason === 'bad format') {
      ready();
      const bad = mocks.texture();
      if (reason === 'bad handle') {
        bad.textureInfo.handle.ntHandle = Buffer.alloc(1);
      } else bad.textureInfo.pixelFormat = 'other';
      win.paintTexture(mocks.full, bad);
      expect(bad.release).toHaveBeenCalledOnce();
    }
    if (reason === 'textures stop') {
      ready();
      worker().emit('message', {type: 'copied'});
      win.webContents.emit('paint', {}, mocks.full);
      vi.advanceTimersByTime(2000);
      win.webContents.emit('paint', {}, mocks.full);
    }
    expect(bitmap).toHaveBeenCalledOnce();
    expect(win.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('keeps the original capture deadline across repeated incomplete frames', () => {
    const {handle, bitmap, win} = setup();
    mocks.status.autoFrame = false;
    start(handle);
    ready();
    vi.advanceTimersByTime(4000);
    const partial = win.paintTexture({x: 0, y: 0, width: 10, height: 10});
    expect(partial.release).toHaveBeenCalledOnce();
    handle.requestFrame();
    vi.advanceTimersByTime(1000);
    expect(bitmap).toHaveBeenCalledOnce();
    expect(win.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('does not treat a stopped capturer as a missing texture failure', () => {
    const {handle, win, bitmap} = setup();
    mocks.status.autoFrame = false;
    start(handle);
    ready();
    win.webContents.stopPainting();
    vi.advanceTimersByTime(5000);
    expect(bitmap).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('ignores a late ready message after hide and stays stopped', () => {
    const {handle, win, bitmap} = setup();
    start(handle);
    handle.hide();
    ready();
    vi.advanceTimersByTime(6000);
    expect(win.webContents.startPainting).not.toHaveBeenCalled();
    expect(bitmap).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('reports a missing runtime without switching to bitmap', () => {
    const {handle, failure, screen, bitmap} = setup();
    start(handle);
    worker().emit('message', {type: 'error', message: 'NDI_RUNTIME_MISSING'});
    expect(failure).toHaveBeenCalledExactlyOnceWith(screen.id, true);
    expect(bitmap).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('restarts an incomplete probe frame rather than invalidating', () => {
    const {handle} = setup();
    start(handle);
    worker().emit('message', {type: 'error', message: 'failed'});
    vi.advanceTimersByTime(5000);
    mocks.status.autoFrame = false;
    const probe = mocks.windows[1];
    if (!probe) throw new Error('Missing probe');
    ready(1);
    const partial = probe.paintTexture({x: 0, y: 0, width: 10, height: 10});
    expect(partial.release).toHaveBeenCalledOnce();
    expect(probe.webContents.startPainting).toHaveBeenCalledTimes(2);
    expect(probe.webContents.invalidate).not.toHaveBeenCalled();
    handle.destroy();
  });
});
