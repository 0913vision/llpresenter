import {NDI_DEFAULT_SOURCE_NAME} from '@core/schema/screens';
import {
  app,
  BrowserWindow,
  utilityProcess,
  type UtilityProcess,
  type OffscreenSharedTexture,
} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../log';
import type {OutputScreen} from '../outputs/screens';
import type {
  OutputWindowEvents,
  OutputWindowHandle,
} from '../outputs/outputWindow';
import {blockNavigation, preloadPath, startLoading} from '../windows/page';
import {
  TextureQueue,
  NDI_FRAME_WIDTH,
  NDI_FRAME_HEIGHT,
  type TextureFrame,
} from './textureQueue';

const GPU_TIMEOUT_MS = 5000;
const GPU_STOP_TIMEOUT_MS = 2000;
const GPU_MISSING_TIMEOUT_MS = 2000;

type GpuTextureFrame = TextureFrame & {
  readonly texture: OffscreenSharedTexture;
};

interface Options {
  log: Logger;
  onFailure: (id: string, missing: boolean) => void;
  onGpuFallback?: () => void;
}
/** Creates the shared-texture sender and falls back to bitmap on GPU failure. */
export function createGpuOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {options, bitmap}: {options: Options; bitmap: () => OutputWindowHandle},
): OutputWindowHandle {
  let active = false;
  let current = screen;
  let switched = false;
  let capture = {x: 0, y: 0, width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT};
  let delegate: OutputWindowHandle;
  const fallback = (reason: unknown): void => {
    if (switched) return;
    switched = true;
    options.log.warn(
      'NDI shared texture unavailable; using bitmap output',
      reason,
    );
    options.onGpuFallback?.();
    delegate.destroy();
    delegate = bitmap();
    delegate.configure(current);
    if (active) delegate.showCapture(capture);
  };
  delegate = gpuHandle(screen, events, {
    log: options.log,
    fallback,
    runtimeMissing: () => options.onFailure(current.id, true),
  });
  return {
    configure: next => {
      current = next;
      delegate.configure(next);
    },
    prepare: (bounds, kind) => delegate.prepare(bounds, kind),
    requestFrame: () => delegate.requestFrame(),
    contentSize: () => delegate.contentSize(),
    setAlwaysOnTop: value => delegate.setAlwaysOnTop(value),
    showFullScreen: (bounds, top) => {
      active = true;
      delegate.showFullScreen(bounds, top);
    },
    showWindowed: (bounds, top) => {
      active = true;
      delegate.showWindowed(bounds, top);
    },
    showCapture: (bounds, top) => {
      active = true;
      capture = bounds;
      delegate.showCapture(bounds, top);
    },
    prepareForMonitorRemoval: () => delegate.prepareForMonitorRemoval(),
    bringToFront: () => delegate.bringToFront(),
    bounds: () => delegate.bounds(),
    hide: () => {
      active = false;
      delegate.hide();
    },
    reload: () => delegate.reload(),
    crashRenderer: () => delegate.crashRenderer(),
    ping: () => delegate.ping(),
    destroy: () => {
      active = false;
      delegate.destroy();
    },
  };
}
function gpuHandle(
  initial: OutputScreen,
  events: OutputWindowEvents,
  {
    log,
    fallback,
    runtimeMissing,
  }: {
    log: Logger;
    fallback: (reason: unknown) => void;
    runtimeMissing: () => void;
  },
): OutputWindowHandle {
  const win = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    width: NDI_FRAME_WIDTH,
    height: NDI_FRAME_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: {useSharedTexture: true},
    },
  });
  win.setMinimumSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.setContentSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.webContents.setFrameRate(30);
  const page = {name: 'output' as const, query: {screen: initial.id, ndi: '1'}};
  blockNavigation(win);
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) =>
    events.onRendererGone(details),
  );
  void startLoading(win, page).catch((error: unknown) => fail(error));
  let current = initial;
  let child: UtilityProcess | null = null;
  let ready = false;
  let seenTexture = false;
  let closed = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let missingSince: number | null = null;
  const clear = (destroyWindow = false): void => {
    if (timeout !== null) clearTimeout(timeout);
    missingSince = null;
    timeout = null;
    const old = child;
    child = null;
    ready = false;
    seenTexture = false;
    const outstanding = queue.clear();
    const finish = (): void => {
      outstanding?.texture.release();
      if (destroyWindow && !win.isDestroyed()) win.destroy();
    };
    if (!old) {
      finish();
      return;
    }
    const killTimer = setTimeout(() => old.kill(), GPU_STOP_TIMEOUT_MS);
    killTimer.unref();
    old.once('exit', () => {
      clearTimeout(killTimer);
      finish();
    });
    if (outstanding) old.kill();
    else {
      try {
        old.postMessage({type: 'stop'});
      } catch {
        old.kill();
      }
    }
  };
  const fail = (reason: unknown): void => {
    if (!closed) fallback(reason);
  };
  const scheduleFailure = (
    reason: string,
    delay: number,
  ): ReturnType<typeof setTimeout> => setTimeout(() => fail(reason), delay);
  const startWatchdog = (reason: string): void => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = scheduleFailure(reason, GPU_TIMEOUT_MS);
  };
  const send = (frame: GpuTextureFrame): void => {
    if (!child) {
      queue.clear()?.texture.release();
      return;
    }
    const info = frame.texture.textureInfo;
    const handle = info.handle.ntHandle;
    if (handle?.length !== 8) {
      fail('unsupported texture handle');
      return;
    }
    try {
      child.postMessage({
        type: 'frame',
        pid: process.pid,
        handle: handle.readBigUInt64LE(0).toString(16),
        dirty: frame.dirty,
        format: info.pixelFormat,
      });
      startWatchdog('GPU copy timeout');
    } catch (error) {
      fail(error);
    }
  };
  const queue = new TextureQueue<GpuTextureFrame>({send});
  win.webContents.on('paint', (event, dirty) => {
    const texture = event.texture;
    if (!texture) {
      if (
        child &&
        ready &&
        app.getGPUFeatureStatus().gpu_compositing !== 'enabled'
      ) {
        fail('GPU compositing is unavailable');
        return;
      }
      if (child && ready && seenTexture) {
        const now = Date.now();
        if (missingSince === null) missingSince = now;
        else if (now - missingSince >= GPU_MISSING_TIMEOUT_MS) {
          fail('shared textures stopped arriving');
        }
      }
      return;
    }
    missingSince = null;
    if (!child || !ready || closed) {
      texture.release();
      return;
    }
    const info = texture.textureInfo;
    if (
      info.handle.ntHandle?.length !== 8 ||
      (info.pixelFormat !== 'bgra' && info.pixelFormat !== 'rgba')
    ) {
      texture.release();
      fail('unsupported texture handle or pixel format');
      return;
    }
    if (!queue.busy && timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    seenTexture = true;
    queue.push({texture, dirty});
  });
  const begin = (): void => {
    if (closed || child) return;
    if (app.getGPUFeatureStatus().gpu_compositing.startsWith('disabled')) {
      fail('GPU compositing is unavailable');
      return;
    }
    const workerPath = join(__dirname, 'ndi/gpu-utility.cjs');
    let worker: UtilityProcess;
    try {
      worker = utilityProcess.fork(workerPath, [], {
        serviceName: 'GPU NDI output',
        env: {
          ...process.env,
          LLP_NDI_DEFAULT_SOURCE_NAME: NDI_DEFAULT_SOURCE_NAME,
          LLP_NDI_SOURCE_NAME:
            current.ndi?.sourceName ?? NDI_DEFAULT_SOURCE_NAME,
        },
      });
    } catch (error) {
      fail(error);
      return;
    }
    child = worker;
    startWatchdog('GPU utility startup timeout');
    worker.on('message', (m: {type: string; message?: string}) => {
      if (child !== worker) return;
      if (m.type === 'native-loaded') log.info('NDI native module loaded');
      if (m.type === 'ready') {
        if (timeout !== null) clearTimeout(timeout);
        ready = true;
        startWatchdog('no shared texture paint');
        win.webContents.invalidate();
      }
      if (m.type === 'copied') {
        if (timeout !== null) clearTimeout(timeout);
        timeout = null;
        queue.acknowledge();
      }
      if (m.type === 'error') {
        if (m.message?.includes('NDI_RUNTIME_MISSING')) {
          clear();
          runtimeMissing();
        } else fail(m.message);
      }
    });
    worker.on('exit', code => {
      if (child === worker) {
        child = null;
        fail(`utility exited ${code}`);
      }
    });
  };
  return {
    configure: next => {
      const changed = next.ndi?.sourceName !== current.ndi?.sourceName;
      current = next;
      if (changed && child) {
        clear();
        begin();
      }
    },
    prepare: () => undefined,
    requestFrame: () => win.webContents.invalidate(),
    contentSize: () => ({width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT}),
    setAlwaysOnTop: () => undefined,
    showFullScreen: () => undefined,
    showWindowed: () => undefined,
    showCapture: () => begin(),
    prepareForMonitorRemoval: () => undefined,
    bringToFront: () => undefined,
    bounds: () => null,
    hide: () => clear(),
    reload: () => startLoading(win, page),
    crashRenderer: () => win.webContents.forcefullyCrashRenderer(),
    ping: async () => {
      await win.webContents.executeJavaScript('0');
    },
    destroy: () => {
      closed = true;
      clear(true);
    },
  };
}
