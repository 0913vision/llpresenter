import {NDI_DEFAULT_HARDWARE_ACCELERATION} from '@core/schema/screens/screens';
import {
  utilityProcess,
  type UtilityProcess,
  type NativeImage,
  type Rectangle,
} from 'electron';
import {join} from 'node:path';
import type {OutputScreen} from '../screens';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import type {Logger} from '../../base/log';
import {unionDirty} from './rect';
import {createGpuOutput} from './gpuOutput';
import {forwardingHandle} from './forwardingHandle';
import {
  applyNdiSettings,
  createNdiWindow,
  ndiOutputHandle,
  ndiSenderEnv,
  stopSender,
} from './ndiWindow';
import {NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT} from './textureQueue';
import type {OutputScreenStatus} from '@core/schema/live/outputStatus';

/**
 * How long the NDI sender may take to answer a frame, or to send its heartbeat,
 * before it counts as failed, in milliseconds.
 */
export const NDI_SEND_TIMEOUT_MS = 5000;
/**
 * How long a stopping NDI sender gets to exit before it is ended, in
 * milliseconds.
 */
export const NDI_STOP_TIMEOUT_MS = 2000;

/**
 * Retains the original sender while accepting frames from a GPU capture. Each
 * submitted frame is handed back exactly once through `done`: sent, or dropped
 * (a stop, a restart, GPU input turned off, a newer frame, a wrong size), so
 * its owner always frees it.
 */
export interface BitmapSender extends OutputWindowHandle {
  setGpuInput(enabled: boolean): void;
  submitGpuPixels(data: Uint8Array, done: (sent: boolean) => void): void;
}

/** Creates an offscreen output whose sender is isolated in a utility process. */
export function createNdiOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: {
    log: Logger;
    onFailure: (id: string, missing: boolean) => void;
    onGpuFallback?: () => void;
    onAcceleration?: (
      status: Pick<
        OutputScreenStatus,
        'ndiAcceleration' | 'ndiAccelerationReason'
      >,
    ) => void;
  },
): OutputWindowHandle {
  let current = screen;
  let active = false;
  let capture = {x: 0, y: 0, width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT};
  const create = (): OutputWindowHandle => {
    const enabled =
      current.ndi?.hardwareAcceleration ?? NDI_DEFAULT_HARDWARE_ACCELERATION;
    options.onAcceleration?.(
      enabled
        ? {ndiAcceleration: 'pending'}
        : {ndiAcceleration: 'bitmap', ndiAccelerationReason: 'disabled'},
    );
    return enabled
      ? createGpuOutput(current, events, {
          options,
          bitmap: () => createBitmapOutput(current, events, options),
        })
      : createBitmapOutput(current, events, options);
  };
  let delegate = create();
  return {
    ...forwardingHandle(() => delegate),
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
    showCapture: (bounds, top) => {
      active = true;
      capture = bounds;
      delegate.showCapture(bounds, top);
    },
    hide: () => {
      active = false;
      delegate.hide();
    },
    destroy: () => {
      active = false;
      delegate.destroy();
    },
  };
}

/** A message of the NDI utility process. */
interface SenderMessage {
  readonly type: string;
  readonly message?: string;
}

/**
 * Sends one screen's page to NDI as bitmaps: an offscreen window paints, and
 * a utility process sends each changed area. A paint that comes while a frame
 * is on its way joins the next one. A GPU output that falls back hands its
 * pixels in instead. A sender that stops answering, fails or exits is a
 * failure of the screen.
 */
export function createBitmapOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: {log: Logger; onFailure: (id: string, missing: boolean) => void},
): BitmapSender {
  const {log, onFailure} = options;
  const ndiWindow = createNdiWindow(screen, events, {
    sharedTexture: false,
    onLoadError: error => log.error('could not load NDI output', error),
  });
  const {win} = ndiWindow;
  let current = screen;
  let child: UtilityProcess | null = null;
  let ready = false;
  let inFlight = false;
  let pending: {dirty: Rectangle; image: NativeImage} | null = null;
  let gpuInput = false;
  let pendingGpu: {
    data: Uint8Array;
    done: (sent: boolean) => void;
  } | null = null;
  let gpuInFlight: ((sent: boolean) => void) | null = null;
  /** Hands back the GPU frames that wait or are on their way, unsent. */
  const dropGpuFrames = (): void => {
    const waiting = pendingGpu;
    const sending = gpuInFlight;
    pendingGpu = null;
    gpuInFlight = null;
    waiting?.done(false);
    sending?.(false);
  };
  let closed = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let heartbeatWatchdog: ReturnType<typeof setTimeout> | null = null;
  const sendFrame = (dirty: Rectangle, image: NativeImage): void => {
    if (child === null) return;
    const data = image.crop(dirty).toBitmap();
    inFlight = true;
    sendMessage(child, {type: 'frame', data: {...dirty, data}});
  };
  const sendGpu = (): void => {
    if (
      !gpuInput ||
      pendingGpu === null ||
      child === null ||
      !ready ||
      inFlight
    ) {
      return;
    }
    const next = pendingGpu;
    pendingGpu = null;
    gpuInFlight = next.done;
    inFlight = true;
    sendMessage(child, {
      type: 'frame',
      data: {
        x: 0,
        y: 0,
        width: NDI_FRAME_WIDTH,
        height: NDI_FRAME_HEIGHT,
        data: Buffer.from(next.data),
      },
    });
  };
  /** A painted area goes now, or joins the area that waits. */
  const queuePaint = (dirty: Rectangle, image: NativeImage): void => {
    if (!inFlight) {
      sendFrame(dirty, image);
      return;
    }
    const previous = pending?.dirty;
    pending =
      previous === undefined
        ? {dirty, image}
        : {image, dirty: unionDirty(previous, dirty)};
  };
  win.webContents.on('paint', (_event, dirty, image) => {
    if (
      child === null ||
      closed ||
      !ready ||
      gpuInput ||
      dirty.width <= 0 ||
      dirty.height <= 0
    ) {
      return;
    }
    const size = image.getSize();
    if (size.width !== NDI_FRAME_WIDTH || size.height !== NDI_FRAME_HEIGHT) {
      return;
    }
    queuePaint(dirty, image);
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
    dropGpuFrames();
    if (old === null || exited) return;
    stopSender(old, {timeoutMs: NDI_STOP_TIMEOUT_MS, log});
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
  /** A frame went out: the next one waiting goes. */
  const sent = (worker: UtilityProcess): void => {
    if (heartbeatWatchdog === null) monitorHeartbeat(worker);
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
    inFlight = false;
    const done = gpuInFlight;
    gpuInFlight = null;
    done?.(true);
    if (gpuInput) sendGpu();
    else if (pending !== null) {
      const {dirty, image} = pending;
      pending = null;
      sendFrame(dirty, image);
    }
  };
  const onMessage = (worker: UtilityProcess, message: SenderMessage): void => {
    switch (message.type) {
      case 'native-loaded':
        log.info('NDI native module loaded');
        return;
      case 'ready':
        ready = true;
        win.webContents.invalidate();
        sendGpu();
        return;
      case 'sent':
        sent(worker);
        return;
      case 'heartbeat':
        if (heartbeatWatchdog !== null) monitorHeartbeat(worker);
        return;
      case 'error':
        fail(
          worker,
          message.message?.includes('NDI_RUNTIME_MISSING') === true,
          message.message,
        );
        return;
      default:
        // NOTE(0913vision): utility.cjs sends no other message.
        return;
    }
  };
  const begin = (): void => {
    if (closed || child !== null) return;
    const worker = utilityProcess.fork(join(__dirname, 'ndi/utility.cjs'), [], {
      serviceName: 'NDI output',
      env: ndiSenderEnv(current),
    });
    child = worker;
    worker.on('message', (message: SenderMessage) => {
      if (child === worker) onMessage(worker, message);
    });
    worker.on('exit', code => {
      if (child !== worker) return;
      log.error('NDI sender exited', code);
      stop(true);
      onFailure(current.id, false);
    });
  };
  return {
    ...ndiOutputHandle(ndiWindow, {
      configure: next => {
        const restart = applyNdiSettings(win, current, next);
        current = next;
        if (restart && child !== null) {
          stop();
          begin();
        }
      },
      begin,
      stop: () => stop(),
      requestFrame: () => win.webContents.invalidate(),
      destroy: () => {
        closed = true;
        stop();
        if (!win.isDestroyed()) win.destroy();
      },
    }),
    setGpuInput: enabled => {
      gpuInput = enabled;
      pending = null;
      if (!enabled) {
        const waiting = pendingGpu;
        pendingGpu = null;
        waiting?.done(false);
        win.webContents.invalidate();
      }
    },
    submitGpuPixels: (data, done) => {
      if (data.byteLength !== NDI_FRAME_WIDTH * NDI_FRAME_HEIGHT * 4) {
        done(false);
        return;
      }
      const replaced = pendingGpu;
      pendingGpu = {data, done};
      replaced?.done(false);
      sendGpu();
    },
  };
}
