import {
  NDI_DEFAULT_HARDWARE_ACCELERATION,
  NDI_DEFAULT_FPS,
  NDI_DEFAULT_SOURCE_NAME,
} from '@core/schema/screens';
import {
  BrowserWindow,
  utilityProcess,
  type UtilityProcess,
  type NativeImage,
  type Rectangle,
} from 'electron';
import {join} from 'node:path';
import type {OutputScreen} from '../outputs/screens';
import type {
  OutputWindowEvents,
  OutputWindowHandle,
} from '../outputs/outputWindow';
import type {Logger} from '../log';
import {blockNavigation, preloadPath, startLoading} from '../windows/page';
import {unionDirty} from './rect';
import {createGpuOutput} from './gpuOutput';
import {NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT} from './textureQueue';

export const NDI_SEND_TIMEOUT_MS = 5000;
export const NDI_STOP_TIMEOUT_MS = 2000;

/** Creates an offscreen output whose sender is isolated in a utility process. */
export function createNdiOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: {
    log: Logger;
    onFailure: (id: string, missing: boolean) => void;
    onGpuFallback?: () => void;
  },
): OutputWindowHandle {
  let current = screen;
  let active = false;
  let capture = {x: 0, y: 0, width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT};
  const create = (): OutputWindowHandle =>
    (current.ndi?.hardwareAcceleration ?? NDI_DEFAULT_HARDWARE_ACCELERATION)
      ? createGpuOutput(current, events, {
          options,
          bitmap: () => createBitmapOutput(current, events, options),
        })
      : createBitmapOutput(current, events, options);
  let delegate = create();
  return {
    configure: next => {
      const changed =
        (current.ndi?.hardwareAcceleration ??
          NDI_DEFAULT_HARDWARE_ACCELERATION) !==
        (next.ndi?.hardwareAcceleration ?? NDI_DEFAULT_HARDWARE_ACCELERATION);
      current = next;
      if (changed) {
        delegate.destroy();
        delegate = create();
        if (active) delegate.showCapture(capture);
      } else delegate.configure(next);
    },
    prepare: (bounds, kind) => delegate.prepare(bounds, kind),
    requestFrame: () => delegate.requestFrame(),
    contentSize: () => delegate.contentSize(),
    setAlwaysOnTop: value => delegate.setAlwaysOnTop(value),
    showFullScreen: (bounds, top) => delegate.showFullScreen(bounds, top),
    showWindowed: (bounds, top) => delegate.showWindowed(bounds, top),
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

function createBitmapOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: {log: Logger; onFailure: (id: string, missing: boolean) => void},
): OutputWindowHandle {
  const {log, onFailure} = options;
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
      offscreen: true,
    },
  });
  win.setMinimumSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.setContentSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.webContents.setFrameRate(
    (screen.ndi?.fps ?? NDI_DEFAULT_FPS) > 30 ? 60 : 30,
  );
  const page = {name: 'output' as const, query: {screen: screen.id, ndi: '1'}};
  blockNavigation(win);
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) =>
    events.onRendererGone(details),
  );
  void startLoading(win, page).catch((error: unknown) =>
    log.error('could not load NDI output', error),
  );
  let current = screen;
  let child: UtilityProcess | null = null;
  let ready = false;
  let inFlight = false;
  let pending: {dirty: Rectangle; image: NativeImage} | null = null;
  let closed = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let heartbeatWatchdog: ReturnType<typeof setTimeout> | null = null;
  const sendFrame = (dirty: Rectangle, image: NativeImage): void => {
    if (child === null) return;
    const data = image.crop(dirty).toBitmap();
    inFlight = true;
    sendMessage(child, {type: 'frame', data: {...dirty, data}});
  };
  win.webContents.on('paint', (_event, dirty, image) => {
    if (
      child === null ||
      closed ||
      !ready ||
      dirty.width <= 0 ||
      dirty.height <= 0
    ) {
      return;
    }
    const size = image.getSize();
    if (size.width !== NDI_FRAME_WIDTH || size.height !== NDI_FRAME_HEIGHT) {
      return;
    }
    if (!inFlight) {
      sendFrame(dirty, image);
      return;
    }
    const previous = pending?.dirty;
    if (previous === undefined) {
      pending = {dirty, image};
      return;
    }
    pending = {image, dirty: unionDirty(previous, dirty)};
  });
  const stop = (exited = false): void => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
    if (heartbeatWatchdog !== null) clearTimeout(heartbeatWatchdog);
    heartbeatWatchdog = null;
    const old = child;
    child = null;
    ready = false;
    inFlight = false;
    pending = null;
    if (old === null || exited) return;
    const killTimer = setTimeout(() => old.kill(), NDI_STOP_TIMEOUT_MS);
    killTimer.unref();
    old.once('exit', () => clearTimeout(killTimer));
    try {
      old.postMessage({type: 'stop'});
    } catch (error) {
      log.warn('NDI sender already stopped', error);
      clearTimeout(killTimer);
      old.kill();
    }
  };
  const fail = (
    worker: UtilityProcess,
    missing: boolean,
    reason: unknown,
  ): void => {
    if (child !== worker) return;
    log.error('NDI sender failed', reason);
    stop();
    onFailure(current.id, missing);
  };
  const sendMessage = (worker: UtilityProcess, message: object): void => {
    try {
      worker.postMessage(message);
      watchdog = setTimeout(
        () => fail(worker, false, 'send timed out'),
        NDI_SEND_TIMEOUT_MS,
      );
    } catch (error) {
      fail(worker, false, error);
    }
  };
  const monitorHeartbeat = (worker: UtilityProcess): void => {
    if (heartbeatWatchdog !== null) clearTimeout(heartbeatWatchdog);
    heartbeatWatchdog = setTimeout(
      () => fail(worker, false, 'sender heartbeat timed out'),
      NDI_SEND_TIMEOUT_MS,
    );
  };
  const begin = (): void => {
    if (closed || child !== null) return;
    const worker = utilityProcess.fork(join(__dirname, 'ndi/utility.cjs'), [], {
      serviceName: 'NDI output',
      env: {
        ...process.env,
        LLP_NDI_FPS: String(current.ndi?.fps ?? NDI_DEFAULT_FPS),
        LLP_NDI_DEFAULT_SOURCE_NAME: NDI_DEFAULT_SOURCE_NAME,
        LLP_NDI_SOURCE_NAME: current.ndi?.sourceName ?? NDI_DEFAULT_SOURCE_NAME,
      },
    });
    child = worker;
    worker.on('message', (message: {type: string; message?: string}) => {
      if (child !== worker) return;
      if (message.type === 'native-loaded') {
        log.info('NDI native module loaded');
      }
      if (message.type === 'ready') {
        ready = true;
        win.webContents.invalidate();
      }
      if (message.type === 'sent') {
        if (heartbeatWatchdog === null) monitorHeartbeat(worker);
        if (watchdog !== null) clearTimeout(watchdog);
        watchdog = null;
        inFlight = false;
        if (pending !== null) {
          const {dirty, image} = pending;
          pending = null;
          sendFrame(dirty, image);
        }
      }
      if (message.type === 'heartbeat' && heartbeatWatchdog !== null) {
        monitorHeartbeat(worker);
      }
      if (message.type === 'error') {
        fail(
          worker,
          message.message?.includes('NDI_RUNTIME_MISSING') === true,
          message.message,
        );
      }
    });
    worker.on('exit', code => {
      if (child !== worker) return;
      log.error('NDI sender exited', code);
      stop(true);
      onFailure(current.id, false);
    });
  };
  return {
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
      if (changed && child !== null) {
        stop();
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
    hide: stop,
    reload: () => startLoading(win, page),
    crashRenderer: () => win.webContents.forcefullyCrashRenderer(),
    ping: async () => {
      await win.webContents.executeJavaScript('0');
    },
    destroy: () => {
      closed = true;
      stop();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
