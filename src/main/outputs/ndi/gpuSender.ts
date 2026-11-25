import {
  NDI_DEFAULT_SOURCE_NAME,
  NDI_DEFAULT_FPS,
} from '@core/schema/screens/screens';
import {
  app,
  utilityProcess,
  type UtilityProcess,
  type OffscreenSharedTexture,
} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../../base/log';
import type {Rect} from '../../displays/rect';
import type {OutputScreen} from '../screens';
import {ndiSettingsChange} from './ndiSettings';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import {
  clearNativeMirror,
  publishNativeMirror,
  setNativeMirror,
} from '../previews/nativeMirror';
import {createNdiWindow, stopSender} from './ndiWindow';
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

/**
 * What a GPU sender reports: a failure that needs the bitmap output, a missing
 * NDI runtime, and the first frame on the network.
 */
export interface GpuSenderOptions {
  readonly log: Logger;
  /** The sender cannot go on; the bitmap output takes over. */
  readonly fallback: (reason: unknown) => void;
  readonly runtimeMissing: () => void;
  /** The first frame went out. */
  readonly live: () => void;
  /**
   * A probe's frames, copied back as pixels instead of sent, for the bitmap
   * output to send while the probe proves the GPU path works again.
   */
  readonly pixels?:
    ((data: Uint8Array, release: () => void) => void) | undefined;
}

/** The NDI output of one screen through shared textures, as a window handle. */
export type GpuSender = OutputWindowHandle & {
  /** Makes this sender's frames the screen's preview. */
  activateMirror(): void;
};

/** A message of the GPU utility process. */
interface UtilityMessage {
  readonly type: string;
  readonly message?: string;
  readonly data?: Uint8Array;
  readonly frame?: Uint8Array;
}

const MIRROR_FRAME_BYTES = 640 * 360 * 4;
const FRAME_BYTES = NDI_FRAME_WIDTH * NDI_FRAME_HEIGHT * 4;

/**
 * Sends one screen's page to NDI through shared textures: an offscreen window
 * paints into GPU textures, and a utility process copies each one and sends
 * it. Paints without a texture, a stalled copy or a utility that exits are
 * failures, and the caller falls back to the bitmap output.
 */
export function createGpuSender(
  initial: OutputScreen,
  events: OutputWindowEvents,
  {log, fallback, runtimeMissing, live, pixels}: GpuSenderOptions,
): GpuSender {
  const {win, reload} = createNdiWindow(initial, events, {
    sharedTexture: true,
    onLoadError: error => fail(error),
  });
  let current = initial;
  let child: UtilityProcess | null = null;
  const postMirror = (message: object): void => {
    try {
      child?.postMessage(message);
    } catch (error) {
      log.warn('could not update NDI preview', error);
    }
  };
  const mirrorPump = {
    enable: (enabled: boolean): void => postMirror({type: 'mirror', enabled}),
    ack: (): void => postMirror({type: 'mirror-ack'}),
  };
  const activateMirror = (): void => setNativeMirror(current.id, mirrorPump);
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
    clearNativeMirror(current.id, mirrorPump);
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
    stopSender(old, {
      timeoutMs: GPU_STOP_TIMEOUT_MS,
      now: outstanding !== null,
      exited: finish,
    });
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
  const onPaint = (
    event: {texture?: OffscreenSharedTexture},
    dirty: Rect,
  ): void => {
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
  };
  win.webContents.on('paint', onPaint);
  const onMessage = (m: UtilityMessage): void => {
    switch (m.type) {
      case 'native-loaded':
        log.info('NDI native module loaded');
        return;
      case 'ready':
        if (timeout !== null) clearTimeout(timeout);
        ready = true;
        timeout = null;
        restartCapture();
        return;
      case 'live':
        live();
        if (!pixels) activateMirror();
        return;
      case 'mirror-frame':
        if (
          m.frame instanceof Uint8Array &&
          m.frame.length === MIRROR_FRAME_BYTES
        ) {
          publishNativeMirror(current.id, m.frame);
        } else mirrorPump.ack();
        return;
      case 'pixels':
        if (!pixels) return;
        if (
          !(m.data instanceof Uint8Array) ||
          m.data.byteLength !== FRAME_BYTES
        ) {
          fail('invalid GPU frame');
          return;
        }
        pixels(m.data, () => {
          queue.acknowledge();
        });
        return;
      case 'copied':
        if (timeout !== null) clearTimeout(timeout);
        timeout = null;
        if (!pixels) queue.acknowledge();
        return;
      case 'error':
        if (m.message?.includes('NDI_RUNTIME_MISSING')) {
          clear();
          runtimeMissing();
        } else fail(m.message);
        return;
      default:
        // NOTE(0913vision): gpu-utility.cjs sends no other message.
        return;
    }
  };
  const begin = (): void => {
    if (closed || child) return;
    paintEvents = 0;
    bitmapPaints = 0;
    if (app.getGPUFeatureStatus().gpu_compositing.startsWith('disabled')) {
      fail('GPU compositing is unavailable');
      return;
    }
    let worker: UtilityProcess;
    try {
      worker = forkGpuUtility(current, pixels !== undefined);
    } catch (error) {
      fail(error);
      return;
    }
    child = worker;
    startWatchdog('GPU utility startup timeout');
    worker.on('message', (m: UtilityMessage) => {
      if (child === worker) onMessage(m);
    });
    worker.on('exit', code => {
      if (child === worker) {
        child = null;
        fail(`utility exited ${code}`);
      }
    });
  };
  return {
    activateMirror,
    previewContents: () => (win.isDestroyed() ? null : win.webContents),
    configure: next => {
      const change = ndiSettingsChange(current, next);
      if (change.frameRate !== undefined) {
        win.webContents.setFrameRate(change.frameRate);
      }
      current = next;
      if (change.restart && child) {
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
    reload,
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

/** Starts the GPU utility process of a screen, as a probe or a sender. */
function forkGpuUtility(screen: OutputScreen, probe: boolean): UtilityProcess {
  return utilityProcess.fork(join(__dirname, 'ndi/gpu-utility.cjs'), [], {
    serviceName: 'GPU NDI output',
    env: {
      ...process.env,
      LLP_NDI_PROBE: probe ? '1' : '0',
      LLP_NDI_FPS: String(screen.ndi?.fps ?? NDI_DEFAULT_FPS),
      LLP_NDI_DEFAULT_SOURCE_NAME: NDI_DEFAULT_SOURCE_NAME,
      LLP_NDI_SOURCE_NAME: screen.ndi?.sourceName ?? NDI_DEFAULT_SOURCE_NAME,
    },
  });
}
