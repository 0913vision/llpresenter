import {NDI_DEFAULT_SOURCE_NAME, NDI_DEFAULT_FPS} from '@core/schema/screens';
import {
  app,
  BrowserWindow,
  utilityProcess,
  type UtilityProcess,
  type OffscreenSharedTexture,
} from 'electron';
import {join} from 'node:path';
import type {OutputScreenStatus} from '@core/schema/outputStatus';
import type {Logger} from '../log';
import type {OutputScreen} from '../outputs/screens';
import type {BitmapSender} from './output';
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
  onAcceleration?: (
    status: Pick<
      OutputScreenStatus,
      'ndiAcceleration' | 'ndiAccelerationReason'
    >,
  ) => void;
}

const RETRY_DELAYS_MS = [5000, 15_000, 60_000, 120_000] as const;

/** Keeps bitmap output live while checking whether shared textures have recovered. */
export function createGpuOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {options, bitmap}: {options: Options; bitmap: () => BitmapSender},
): OutputWindowHandle {
  let active = false;
  let closed = false;
  let current = screen;
  let mode: 'gpu' | 'bitmap' = 'gpu';
  let retryIndex = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let probe: OutputWindowHandle | null = null;
  let sink: BitmapSender | null = null;
  let capture = {x: 0, y: 0, width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT};
  let delegate: OutputWindowHandle;
  const clearTimers = (): void => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const scheduleProbe = (): void => {
    if (
      !active ||
      closed ||
      mode !== 'bitmap' ||
      retryTimer !== null ||
      probe !== null
    ) {
      return;
    }
    const delay =
      RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)] ??
      120_000;
    retryIndex++;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!active || closed || mode !== 'bitmap') return;
      options.log.info('retrying NDI hardware acceleration');
      const candidate = makeGpu(true);
      probe = candidate;
      candidate.showCapture(capture);
    }, delay);
  };
  const enterBitmap = (reason: unknown): void => {
    if (mode === 'bitmap' || closed || !active) return;
    mode = 'bitmap';
    options.onAcceleration?.({
      ndiAcceleration: 'bitmap',
      ndiAccelerationReason:
        reason === 'no shared texture paint' ||
        reason === 'shared textures stopped arriving'
          ? 'no-texture'
          : reason === 'GPU compositing is unavailable'
            ? 'compositor'
            : 'error',
    });
    options.log.warn(
      'NDI shared texture unavailable; using bitmap output',
      reason,
    );
    delegate.destroy();
    sink ??= bitmap();
    sink.setGpuInput(false);
    delegate = sink;
    delegate.configure(current);
    delegate.showCapture(capture);
    retryIndex = 0;
    scheduleProbe();
  };
  const makeGpu = (background: boolean): OutputWindowHandle => {
    let isProbe = background;
    const failed = (reason: unknown): void => {
      if (closed || !active) return;
      if (isProbe) {
        if (probe !== candidate) return;
        probe = null;
        sink?.setGpuInput(false);
        candidate.destroy();
        scheduleProbe();
        return;
      }
      if (delegate !== candidate || mode !== 'gpu') return;
      enterBitmap(reason);
    };
    const promote = (): void => {
      if (
        !isProbe ||
        probe !== candidate ||
        !active ||
        mode !== 'bitmap' ||
        closed
      ) {
        return;
      }
      probe = null;
      isProbe = false;
      delegate = candidate;
      mode = 'gpu';
      options.onAcceleration?.({ndiAcceleration: 'hardware'});
      clearTimers();
    };
    const candidate = gpuHandle(
      current,
      background
        ? {
            ...events,
            onRendererGone: details => {
              if (isProbe) failed(details);
              else events.onRendererGone(details);
            },
          }
        : events,
      {
        log: options.log,
        fallback: failed,
        runtimeMissing: () => {
          if (isProbe) failed('NDI runtime missing');
          else options.onFailure(current.id, true);
        },
        live: () => {
          if (!background && delegate === candidate) {
            options.onAcceleration?.({ndiAcceleration: 'hardware'});
          }
        },
        ...(background
          ? {
              pixels: (data: Uint8Array, release: () => void) => {
                if (
                  !sink ||
                  !active ||
                  closed ||
                  (isProbe ? probe !== candidate : delegate !== candidate)
                ) {
                  release();
                  return;
                }
                sink.setGpuInput(true);
                sink.submitGpuPixels(data, () => {
                  release();
                  promote();
                });
              },
            }
          : {}),
      },
    );
    return candidate;
  };
  delegate = makeGpu(false);
  return {
    previewContents: () => delegate.previewContents?.() ?? null,
    configure: next => {
      current = next;
      delegate.configure(next);
      if (sink && sink !== delegate) sink.configure(next);
      probe?.configure(next);
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
      if (!active && mode !== 'bitmap') {
        options.onAcceleration?.({ndiAcceleration: 'pending'});
      }
      active = true;
      capture = bounds;
      if (sink && sink !== delegate) sink.showCapture(bounds, top);
      delegate.showCapture(bounds, top);
      if (mode === 'bitmap') scheduleProbe();
    },
    prepareForMonitorRemoval: () => delegate.prepareForMonitorRemoval(),
    bringToFront: () => delegate.bringToFront(),
    bounds: () => delegate.bounds(),
    hide: () => {
      active = false;
      clearTimers();
      probe?.destroy();
      probe = null;
      sink?.setGpuInput(false);
      if (sink && sink !== delegate) sink.hide();
      delegate.hide();
    },
    reload: () => delegate.reload(),
    crashRenderer: () => delegate.crashRenderer(),
    ping: () => delegate.ping(),
    destroy: () => {
      active = false;
      closed = true;
      clearTimers();
      probe?.destroy();
      probe = null;
      if (sink && sink !== delegate) sink.destroy();
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
    live,
    pixels,
  }: {
    log: Logger;
    fallback: (reason: unknown) => void;
    runtimeMissing: () => void;
    live: () => void;
    pixels?: ((data: Uint8Array, release: () => void) => void) | undefined;
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
  win.webContents.stopPainting();
  win.setMinimumSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.setContentSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.webContents.setFrameRate(
    (initial.ndi?.fps ?? NDI_DEFAULT_FPS) > 30 ? 60 : 30,
  );
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
  let requireFullFrame = false;
  let paintEvents = 0;
  let bitmapPaints = 0;
  let closed = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let captureTimeout: ReturnType<typeof setTimeout> | null = null;
  let missingSince: number | null = null;
  const clear = (destroyWindow = false): void => {
    if (timeout !== null) clearTimeout(timeout);
    if (captureTimeout !== null) clearTimeout(captureTimeout);
    captureTimeout = null;
    if (!win.isDestroyed()) win.webContents.stopPainting();
    missingSince = null;
    timeout = null;
    const old = child;
    child = null;
    ready = false;
    seenTexture = false;
    requireFullFrame = false;
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
  const startWatchdog = (reason: string): void => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => fail(reason), GPU_TIMEOUT_MS);
  };
  const restartCapture = (): void => {
    if (closed || !child || !ready || win.isDestroyed()) return;
    win.webContents.stopPainting();
    requireFullFrame = true;
    captureTimeout ??= setTimeout(() => {
      captureTimeout = null;
      if (win.isDestroyed() || !win.webContents.isPainting()) return;
      log.warn('NDI shared texture diagnostics', {
        paintEvents,
        bitmapPaints,
        gpuCompositing: app.getGPUFeatureStatus().gpu_compositing,
      });
      fail('no shared texture paint');
    }, GPU_TIMEOUT_MS);
    win.webContents.startPainting();
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
    paintEvents++;
    const texture = event.texture;
    if (!texture) {
      bitmapPaints++;
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
    if (
      requireFullFrame &&
      (dirty.x !== 0 ||
        dirty.y !== 0 ||
        dirty.width !== NDI_FRAME_WIDTH ||
        dirty.height !== NDI_FRAME_HEIGHT)
    ) {
      texture.release();
      restartCapture();
      return;
    }
    if (!queue.busy && timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    seenTexture = true;
    requireFullFrame = false;
    if (captureTimeout !== null) clearTimeout(captureTimeout);
    captureTimeout = null;
    queue.push({texture, dirty});
  });
  const begin = (): void => {
    if (closed || child) return;
    paintEvents = 0;
    bitmapPaints = 0;
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
          LLP_NDI_PROBE: pixels ? '1' : '0',
          LLP_NDI_FPS: String(current.ndi?.fps ?? NDI_DEFAULT_FPS),
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
    worker.on(
      'message',
      (m: {
        type: string;
        message?: string;
        data?: Uint8Array;
      }) => {
        if (child !== worker) return;
        if (m.type === 'native-loaded') log.info('NDI native module loaded');
        if (m.type === 'ready') {
          if (timeout !== null) clearTimeout(timeout);
          ready = true;
          timeout = null;
          restartCapture();
        }
        if (m.type === 'live') {
          live();
        }
        if (m.type === 'pixels' && pixels) {
          if (
            !(m.data instanceof Uint8Array) ||
            m.data.byteLength !== NDI_FRAME_WIDTH * NDI_FRAME_HEIGHT * 4
          ) {
            fail('invalid GPU frame');
            return;
          }
          pixels(m.data, () => {
            queue.acknowledge();
          });
        }
        if (m.type === 'copied') {
          if (timeout !== null) clearTimeout(timeout);
          timeout = null;
          if (!pixels) queue.acknowledge();
        }
        if (m.type === 'error') {
          if (m.message?.includes('NDI_RUNTIME_MISSING')) {
            clear();
            runtimeMissing();
          } else fail(m.message);
        }
      },
    );
    worker.on('exit', code => {
      if (child === worker) {
        child = null;
        fail(`utility exited ${code}`);
      }
    });
  };
  return {
    previewContents: () => (win.isDestroyed() ? null : win.webContents),
    configure: next => {
      const changed =
        next.ndi?.sourceName !== current.ndi?.sourceName ||
        (next.ndi?.fps ?? NDI_DEFAULT_FPS) !==
          (current.ndi?.fps ?? NDI_DEFAULT_FPS);
      if (
        (next.ndi?.fps ?? NDI_DEFAULT_FPS) !==
        (current.ndi?.fps ?? NDI_DEFAULT_FPS)
      ) {
        win.webContents.setFrameRate(
          (next.ndi?.fps ?? NDI_DEFAULT_FPS) > 30 ? 60 : 30,
        );
      }
      current = next;
      if (changed && child) {
        clear();
        begin();
      }
    },
    prepare: () => undefined,
    requestFrame: restartCapture,
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
