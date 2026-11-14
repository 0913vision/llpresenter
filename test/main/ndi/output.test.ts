import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';
import {
  createNdiOutput,
  NDI_SEND_TIMEOUT_MS,
  NDI_STOP_TIMEOUT_MS,
} from '@main/ndi/output';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class Worker extends EventEmitter {
    readonly postMessage = vi.fn<(message: object) => void>();
    readonly kill = vi.fn();
  }
  class Window extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      setFrameRate: vi.fn(),
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
vi.mock('@main/windows/page', () => ({
  blockNavigation: vi.fn(),
  preloadPath: 'preload.js',
  startLoading: vi.fn(async () => undefined),
}));

function setup(gpu: boolean | 'absent' = false) {
  const screen = fullScreenScreen({
    method: 'capture',
    target: 'ndi',
    ...(gpu === 'absent' ? {} : {ndi: {hardwareAcceleration: gpu}}),
  });
  const failure = vi.fn();
  const fallback = vi.fn();
  const handle = createNdiOutput(
    screen,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {
      log: recordingLogger(),
      onFailure: failure,
      onGpuFallback: fallback,
    },
  );
  const win = mocks.windows.at(-1);
  if (!win) throw new Error('Missing window');
  const worker = () => {
    const found = mocks.workers.at(-1);
    if (!found) throw new Error('Missing worker');
    return found;
  };
  const image = () => ({
    getSize: () => ({width: 1920, height: 1080}),
    crop: vi.fn(() => ({toBitmap: () => Buffer.alloc(4)})),
  });
  return {screen, failure, fallback, handle, win, worker, image};
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  mocks.windows.length = 0;
  mocks.workers.length = 0;
  mocks.fork.mockClear();
  mocks.gpuStatus.mockClear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('NDI output handle', () => {
  it('merges pending dirty rectangles and sends the latest image after acknowledgement', () => {
    const {handle, win, worker, image} = setup();
    handle.showCapture({x: 0, y: 0, width: 1920, height: 1080});
    worker().emit('message', {type: 'ready'});
    const first = image();
    const second = image();
    const latest = image();
    win.webContents.emit('paint', {}, {x: 1, y: 2, width: 3, height: 4}, first);
    win.webContents.emit(
      'paint',
      {},
      {x: 10, y: 20, width: 2, height: 4},
      second,
    );
    win.webContents.emit(
      'paint',
      {},
      {x: 8, y: 19, width: 5, height: 2},
      latest,
    );
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
    worker().emit('message', {type: 'sent'});
    expect(latest.crop).toHaveBeenCalledWith({
      x: 8,
      y: 19,
      width: 5,
      height: 5,
    });
    expect(worker().postMessage).toHaveBeenCalledTimes(2);
    handle.destroy();
  });
  it.each([
    ['NDI_RUNTIME_MISSING', true],
    ['other', false],
  ])('reports sender error %s once', (message, missing) => {
    const {handle, worker, failure, screen} = setup();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    const process = worker();
    process.emit('message', {type: 'error', message});
    process.emit('exit', 1);
    expect(failure).toHaveBeenCalledExactlyOnceWith(screen.id, missing);
    handle.destroy();
  });
  it('reports an unexpected exit once', () => {
    const {handle, worker, failure, screen} = setup();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    worker().emit('exit', 1);
    expect(failure).toHaveBeenCalledExactlyOnceWith(screen.id, false);
    handle.destroy();
  });
  it('does not send keepalive messages after a frame', () => {
    const {handle, win, worker, image} = setup();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    worker().emit('message', {type: 'ready'});
    vi.advanceTimersByTime(1000);
    expect(worker().postMessage).not.toHaveBeenCalled();
    win.webContents.emit(
      'paint',
      {},
      {x: 0, y: 0, width: 1, height: 1},
      image(),
    );
    worker().emit('message', {type: 'sent'});
    vi.advanceTimersByTime(999);
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(worker().postMessage).toHaveBeenCalledTimes(1);
    handle.destroy();
  });
  it('detects a stalled idle sender and keeps the frame watchdog independent', () => {
    const {handle, win, worker, failure, screen, image} = setup();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    const process = worker();
    process.emit('message', {type: 'ready'});
    win.webContents.emit(
      'paint',
      {},
      {x: 0, y: 0, width: 1, height: 1},
      image(),
    );
    process.emit('message', {type: 'sent'});
    vi.advanceTimersByTime(4000);
    process.emit('message', {type: 'heartbeat'});
    vi.advanceTimersByTime(4000);
    expect(failure).not.toHaveBeenCalled();
    expect(process.postMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(failure).toHaveBeenCalledExactlyOnceWith(screen.id, false);
    handle.destroy();

    const next = setup();
    next.handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    const worker2 = next.worker();
    worker2.emit('message', {type: 'ready'});
    next.win.webContents.emit(
      'paint',
      {},
      {x: 0, y: 0, width: 1, height: 1},
      next.image(),
    );
    worker2.emit('message', {type: 'sent'});
    next.win.webContents.emit(
      'paint',
      {},
      {x: 0, y: 0, width: 1, height: 1},
      next.image(),
    );
    vi.advanceTimersByTime(4000);
    worker2.emit('message', {type: 'heartbeat'});
    vi.advanceTimersByTime(1000);
    expect(next.failure).toHaveBeenCalledOnce();
    next.handle.destroy();
  });
  it.each([false, true])(
    'sets paint rate and restarts on fps change (GPU: %s)',
    gpu => {
      const {handle, win, worker, screen} = setup(gpu);
      handle.showCapture({x: 0, y: 0, width: 1, height: 1});
      expect(win.webContents.setFrameRate).toHaveBeenLastCalledWith(30);
      for (const [fps, paint] of [
        [29.97, 30],
        [30, 30],
        [59.94, 60],
        [60, 60],
      ] as const) {
        const previous = worker();
        handle.configure({...screen, ndi: {hardwareAcceleration: gpu, fps}});
        expect(previous.postMessage).toHaveBeenCalledWith({type: 'stop'});
        expect(win.webContents.setFrameRate).toHaveBeenLastCalledWith(paint);
      }
      const count = mocks.fork.mock.calls.length;
      handle.configure({...screen, ndi: {hardwareAcceleration: gpu, fps: 60}});
      expect(mocks.fork).toHaveBeenCalledTimes(count);
      handle.destroy();
    },
  );
  it('restarts only when the source name changes and stops on hide and destroy', () => {
    const {handle, worker, screen} = setup();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    const original = worker();
    handle.configure(screen);
    expect(mocks.fork).toHaveBeenCalledTimes(1);
    handle.configure({...screen, ndi: {sourceName: 'Changed'}});
    expect(original.postMessage).toHaveBeenCalledWith({type: 'stop'});
    expect(mocks.fork).toHaveBeenCalledTimes(2);
    const next = worker();
    handle.hide();
    expect(next.postMessage).toHaveBeenCalledWith({type: 'stop'});
    original.emit('exit', 0);
    next.emit('exit', 0);
    expect(vi.getTimerCount()).toBe(0);
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    const final = worker();
    handle.destroy();
    expect(final.postMessage).toHaveBeenCalledWith({type: 'stop'});
    final.emit('exit', 0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('falls back on a post error or a send timeout and kills a stuck worker on stop', () => {
    const {handle, win, worker, failure, image} = setup();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    worker().emit('message', {type: 'ready'});
    worker().postMessage.mockImplementationOnce(() => {
      throw new Error('dead');
    });
    win.webContents.emit(
      'paint',
      {},
      {x: 0, y: 0, width: 1, height: 1},
      image(),
    );
    expect(failure).toHaveBeenCalledOnce();
    const failed = worker();
    vi.advanceTimersByTime(NDI_STOP_TIMEOUT_MS);
    expect(failed.kill).toHaveBeenCalledOnce();
    handle.showCapture({x: 0, y: 0, width: 1, height: 1});
    const stuck = worker();
    stuck.emit('message', {type: 'ready'});
    win.webContents.emit(
      'paint',
      {},
      {x: 0, y: 0, width: 1, height: 1},
      image(),
    );
    vi.advanceTimersByTime(NDI_SEND_TIMEOUT_MS);
    expect(failure).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(NDI_STOP_TIMEOUT_MS);
    expect(stuck.kill).toHaveBeenCalledOnce();
    handle.destroy();
  });
});

describe('GPU NDI output', () => {
  function texture() {
    return {
      release: vi.fn(),
      textureInfo: {
        handle: {ntHandle: Buffer.alloc(8, 1)},
        pixelFormat: 'bgra',
      },
    };
  }
  const full = {x: 0, y: 0, width: 1920, height: 1080};
  it('retries a startup timeout once before using bitmap', () => {
    const {handle, worker, fallback} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'ready'});
    vi.advanceTimersByTime(5000);
    expect(mocks.workers).toHaveLength(1);
    vi.advanceTimersByTime(2500);
    expect(mocks.workers).toHaveLength(2);
    worker().emit('message', {type: 'ready'});
    vi.advanceTimersByTime(5000);
    expect(mocks.windows).toHaveLength(3);
    expect(fallback).not.toHaveBeenCalled();
    handle.destroy();
  });
  it('keeps bitmap sending until the GPU probe sends its first frame', () => {
    const {handle, worker} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'error', message: 'GPU failure'});
    const bitmap = worker();
    bitmap.emit('message', {type: 'ready'});
    vi.advanceTimersByTime(5000);
    const candidate = worker();
    const probeWindow = mocks.windows.at(-1);
    if (!probeWindow) throw new Error('Missing GPU probe');
    candidate.emit('message', {type: 'ready'});
    const partial = texture();
    probeWindow.webContents.emit(
      'paint',
      {texture: partial},
      {x: 0, y: 0, width: 1, height: 1},
      {},
    );
    expect(partial.release).toHaveBeenCalledOnce();
    expect(candidate.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({type: 'frame'}),
    );
    const frame = texture();
    probeWindow.webContents.emit('paint', {texture: frame}, full, {});
    candidate.emit('message', {type: 'copied'});
    candidate.emit('message', {
      type: 'pixels',
      data: Buffer.alloc(1920 * 1080 * 4),
    });
    expect(bitmap.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({type: 'frame'}),
    );
    expect(bitmap.postMessage).not.toHaveBeenCalledWith({type: 'stop'});
    expect(frame.release).not.toHaveBeenCalled();
    bitmap.emit('message', {type: 'sent'});
    expect(frame.release).toHaveBeenCalledOnce();
    expect(bitmap.postMessage).not.toHaveBeenCalledWith({type: 'stop'});
    candidate.emit('message', {type: 'error', message: 'GPU failed again'});
    expect(mocks.workers).toHaveLength(3);
    handle.destroy();
  });
  it('retries silently beyond 60 seconds and recovers', () => {
    const {handle, worker, fallback} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'error', message: 'GPU failure'});
    const bitmap = worker();
    bitmap.emit('message', {type: 'ready'});
    vi.advanceTimersByTime(5000);
    worker().emit('message', {type: 'error', message: 'GPU failure'});
    vi.advanceTimersByTime(15000);
    worker().emit('message', {type: 'error', message: 'GPU failure'});
    vi.advanceTimersByTime(39999);
    expect(fallback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fallback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20000);
    const candidate = worker();
    const probeWindow = mocks.windows.at(-1);
    if (!probeWindow) throw new Error('Missing GPU probe');
    candidate.emit('message', {type: 'ready'});
    probeWindow.webContents.emit('paint', {texture: texture()}, full, {});
    candidate.emit('message', {type: 'copied'});
    candidate.emit('message', {
      type: 'pixels',
      data: Buffer.alloc(1920 * 1080 * 4),
    });
    bitmap.emit('message', {type: 'sent'});
    handle.destroy();
  });
  it('cancels retries and notices when hidden', () => {
    const {handle, worker, fallback} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'error', message: 'GPU failure'});
    const count = mocks.workers.length;
    handle.hide();
    vi.advanceTimersByTime(180_000);
    expect(mocks.workers).toHaveLength(count);
    expect(fallback).not.toHaveBeenCalled();
    handle.destroy();
  });
  it('keeps a texture until copy acknowledgement and until worker exit on stop', () => {
    const {handle, win, worker} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'ready'});
    const a = texture();
    win.webContents.emit('paint', {texture: a}, full, {});
    expect(a.release).not.toHaveBeenCalled();
    worker().emit('message', {type: 'copied'});
    expect(a.release).toHaveBeenCalledOnce();
    const b = texture();
    win.webContents.emit('paint', {texture: b}, full, {});
    handle.destroy();
    expect(b.release).not.toHaveBeenCalled();
    worker().emit('exit', 0);
    expect(b.release).toHaveBeenCalledOnce();
  });
  it('falls back immediately without a notice after a GPU error', () => {
    const {handle, worker, fallback} = setup(true);
    handle.showCapture(full);
    const gpuWorker = worker();
    gpuWorker.emit('message', {type: 'error', message: 'open failed'});
    gpuWorker.emit('message', {type: 'error', message: 'open failed'});
    expect(fallback).not.toHaveBeenCalled();
    expect(mocks.windows).toHaveLength(2);
    expect(mocks.workers).toHaveLength(2);
    vi.advanceTimersByTime(60_000);
    expect(fallback).not.toHaveBeenCalled();
    handle.destroy();
  });
  it('continues after queue overflow when painting stops', () => {
    const {handle, win, worker, fallback} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'ready'});
    const frames = Array.from({length: 4}, texture);
    for (const item of frames) {
      win.webContents.emit('paint', {texture: item}, full, {});
    }
    worker().emit('message', {type: 'copied'});
    expect(worker().postMessage).toHaveBeenCalledTimes(2);
    worker().emit('message', {type: 'copied'});
    vi.advanceTimersByTime(6000);
    expect(fallback).not.toHaveBeenCalled();
    expect(frames[3]?.release).toHaveBeenCalledOnce();
    handle.destroy();
  });
  it('checks GPU status at startup and on textureless paint, not every frame', () => {
    const {handle, win, worker} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'ready'});
    win.webContents.emit('paint', {texture: texture()}, full, {});
    expect(mocks.gpuStatus).toHaveBeenCalledOnce();
    win.webContents.emit('paint', {}, full, {});
    expect(mocks.gpuStatus).toHaveBeenCalledTimes(2);
    handle.destroy();
  });
  it('reports a missing runtime through the normal NDI failure path', () => {
    const {handle, worker, failure, fallback, screen} = setup(true);
    handle.showCapture(full);
    const gpuWorker = worker();
    gpuWorker.emit('message', {type: 'error', message: 'NDI_RUNTIME_MISSING'});
    gpuWorker.emit('exit', 1);
    expect(failure).toHaveBeenCalledExactlyOnceWith(screen.id, true);
    expect(fallback).not.toHaveBeenCalled();
    handle.destroy();
  });
  it('releases an invalid handle and falls back once', () => {
    const {handle, win, worker, fallback} = setup(true);
    handle.showCapture(full);
    worker().emit('message', {type: 'ready'});
    const bad = texture();
    bad.textureInfo.handle.ntHandle = Buffer.alloc(1);
    win.webContents.emit('paint', {texture: bad}, full, {});
    expect(bad.release).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
    expect(mocks.windows).toHaveLength(2);
    handle.destroy();
  });
  it('falls back once if the GPU utility crashes', () => {
    const {handle, worker, fallback} = setup(true);
    handle.showCapture(full);
    worker().emit('exit', 1);
    expect(fallback).not.toHaveBeenCalled();
    expect(mocks.windows).toHaveLength(2);
    handle.destroy();
  });
  it('starts with acceleration when the option is absent', () => {
    const {handle} = setup('absent');
    handle.showCapture(full);
    expect(mocks.gpuStatus).toHaveBeenCalledOnce();
    expect(mocks.workers).toHaveLength(1);
    handle.destroy();
  });
  it('starts without acceleration when false is stored', () => {
    const {handle} = setup(false);
    handle.showCapture(full);
    expect(mocks.gpuStatus).not.toHaveBeenCalled();
    expect(mocks.workers).toHaveLength(1);
    handle.destroy();
  });
  it('restarts the active output when acceleration is turned off', () => {
    const {handle, screen, win, worker} = setup('absent');
    handle.showCapture(full);
    const gpuWorker = worker();
    handle.configure({...screen, ndi: {hardwareAcceleration: false}});
    expect(gpuWorker.postMessage).toHaveBeenCalledWith({type: 'stop'});
    gpuWorker.emit('exit', 0);
    expect(win.destroy).toHaveBeenCalledOnce();
    expect(mocks.windows).toHaveLength(2);
    expect(mocks.workers).toHaveLength(2);
    handle.destroy();
  });
});
