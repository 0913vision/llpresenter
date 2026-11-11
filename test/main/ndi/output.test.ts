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
  return {Window, windows, workers, fork};
});
vi.mock('electron', () => ({
  BrowserWindow: mocks.Window,
  utilityProcess: {fork: mocks.fork},
}));
vi.mock('@main/windows/page', () => ({
  blockNavigation: vi.fn(),
  preloadPath: 'preload.js',
  startLoading: vi.fn(async () => undefined),
}));

function setup() {
  const screen = fullScreenScreen({method: 'capture', target: 'ndi'});
  const failure = vi.fn();
  const handle = createNdiOutput(
    screen,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {log: recordingLogger(), onFailure: failure},
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
  return {screen, failure, handle, win, worker, image};
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  mocks.windows.length = 0;
  mocks.workers.length = 0;
  mocks.fork.mockClear();
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
  it('keeps alive only after a frame has been sent and one second has elapsed', () => {
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
    expect(worker().postMessage).toHaveBeenLastCalledWith({type: 'repeat'});
    handle.destroy();
  });
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
