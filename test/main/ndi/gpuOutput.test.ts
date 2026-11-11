import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createGpuOutput} from '@main/ndi/gpuOutput';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class Worker extends EventEmitter {
    postMessage = vi.fn();
    kill = vi.fn();
  }
  class Window extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), {
      setFrameRate: vi.fn(),
      invalidate: vi.fn(),
      executeJavaScript: vi.fn(async () => 0),
      forcefullyCrashRenderer: vi.fn(),
    });
    setMinimumSize = vi.fn();
    setContentSize = vi.fn();
    isDestroyed = vi.fn(() => false);
    destroy = vi.fn();
  }
  const worker = new Worker();
  const queue = {
    busy: false,
    push: vi.fn(),
    clear: vi.fn(() => null),
    acknowledge: vi.fn(() => true),
  };
  return {Worker, Window, worker, queue};
});
vi.mock('electron', () => ({
  BrowserWindow: mocks.Window,
  app: {getGPUFeatureStatus: () => ({gpu_compositing: 'enabled'})},
  utilityProcess: {fork: () => mocks.worker},
}));
vi.mock('@main/windows/page', () => ({
  blockNavigation: vi.fn(),
  preloadPath: '',
  startLoading: vi.fn(async () => undefined),
}));
vi.mock('@main/ndi/textureQueue', () => ({
  NDI_FRAME_WIDTH: 1920,
  NDI_FRAME_HEIGHT: 1080,
  TextureQueue: function MockTextureQueue() {
    return mocks.queue;
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.worker.removeAllListeners();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setup() {
  const failure = vi.fn();
  const fallback = vi.fn();
  const bitmap = vi.fn();
  const screen = fullScreenScreen({method: 'capture', target: 'ndi'});
  const handle = createGpuOutput(
    screen,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {
      options: {
        log: recordingLogger(),
        onFailure: failure,
        onGpuFallback: fallback,
      },
      bitmap,
    },
  );
  return {handle, failure, fallback, screen};
}

describe('GPU sender lifecycle', () => {
  it('clears the queue and reports a missing runtime without a GPU notice', () => {
    const {handle, failure, fallback, screen} = setup();
    handle.showCapture({x: 0, y: 0, width: 1920, height: 1080});
    mocks.worker.emit('message', {
      type: 'error',
      message: 'NDI_RUNTIME_MISSING',
    });
    expect(mocks.queue.clear).toHaveBeenCalledOnce();
    expect(failure).toHaveBeenCalledExactlyOnceWith(screen.id, true);
    expect(fallback).not.toHaveBeenCalled();
    handle.destroy();
  });
  it('forwards a copy acknowledgement to the queue', () => {
    const {handle} = setup();
    handle.showCapture({x: 0, y: 0, width: 1920, height: 1080});
    mocks.worker.emit('message', {type: 'ready'});
    mocks.worker.emit('message', {type: 'copied'});
    expect(mocks.queue.acknowledge).toHaveBeenCalledOnce();
    handle.destroy();
  });
});
