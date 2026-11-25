import {app, type OffscreenSharedTexture} from 'electron';
import type {Logger} from '../../base/log';
import type {Rect} from '../../displays/rect';
import type {OutputScreen} from '../screens';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import {
  clearNativeMirror,
  publishNativeMirror,
  setNativeMirror,
} from '../previews/nativeMirror';
import {GPU_TIMEOUT_MS, GpuUtilityProcess} from './gpuUtilityProcess';
import {
  applyNdiSettings,
  createNdiWindow,
  ndiOutputHandle,
  type NdiSender,
  type NdiWindow,
} from './ndiWindow';
import {
  TextureQueue,
  NDI_FRAME_WIDTH,
  NDI_FRAME_HEIGHT,
  type TextureFrame,
} from './textureQueue';

/** How long paints may come without a texture after the first one, in milliseconds. */
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

/**
 * How the window's paints have gone since the sender started: how many came,
 * how many without a texture, and since when textures stopped coming after the
 * first one, for the diagnostics of a capture that never starts.
 */
class CaptureHealth {
  paintEvents = 0;
  bitmapPaints = 0;
  private seenTexture = false;
  private missingSince: number | null = null;

  /** Starts counting again, as for a new sender. */
  restart(): void {
    this.paintEvents = 0;
    this.bitmapPaints = 0;
  }

  /** The sender stopped: nothing was seen yet. */
  reset(): void {
    this.seenTexture = false;
    this.missingSince = null;
  }

  textureCame(): void {
    this.paintEvents++;
    this.missingSince = null;
  }

  textureSent(): void {
    this.seenTexture = true;
  }

  /**
   * A paint came without a texture.
   *
   * @returns Whether textures stopped coming for too long after the first one.
   */
  textureMissing(watching: boolean, now: number): boolean {
    this.paintEvents++;
    this.bitmapPaints++;
    if (!watching || !this.seenTexture) return false;
    if (this.missingSince === null) {
      this.missingSince = now;
      return false;
    }
    return now - this.missingSince >= GPU_MISSING_TIMEOUT_MS;
  }
}

/**
 * Sends one screen's page to NDI through shared textures: an offscreen window
 * paints into GPU textures, and a {@link GpuUtilityProcess} copies each one and
 * sends it, one at a time through a {@link TextureQueue}. Paints without a
 * texture, a capture that never starts, a stalled copy or a utility that exits
 * are failures, and the caller falls back to the bitmap output.
 */
class SharedTextureSender implements NdiSender {
  private screen: OutputScreen;
  private utility: GpuUtilityProcess | null = null;
  private ready = false;
  private closed = false;
  /** A full frame must come first after a capture (re)starts. */
  private requireFullFrame = false;
  private captureTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly health = new CaptureHealth();
  private readonly queue = new TextureQueue<GpuTextureFrame>({
    send: frame => this.send(frame),
  });
  private readonly mirrorPump = {
    enable: (enabled: boolean): void =>
      this.postMirror({type: 'mirror', enabled}),
    ack: (): void => this.postMirror({type: 'mirror-ack'}),
  };

  readonly window: NdiWindow;

  constructor(
    screen: OutputScreen,
    events: OutputWindowEvents,
    private readonly options: GpuSenderOptions,
  ) {
    this.screen = screen;
    this.window = createNdiWindow(screen, events, {
      sharedTexture: true,
      onLoadError: error => this.fail(error),
    });
    this.window.win.webContents.on('paint', (event, dirty) => {
      this.painted(event, dirty);
    });
  }

  readonly configure = (next: OutputScreen): void => {
    const restart = applyNdiSettings(this.window.win, this.screen, next);
    this.screen = next;
    if (restart && this.utility !== null) {
      this.clear();
      this.begin();
    }
  };

  readonly begin = (): void => {
    if (this.closed || this.utility !== null) return;
    this.health.restart();
    if (app.getGPUFeatureStatus().gpu_compositing.startsWith('disabled')) {
      this.fail('GPU compositing is unavailable');
      return;
    }
    try {
      this.utility = this.startUtility();
    } catch (error) {
      this.fail(error);
    }
  };

  readonly stop = (): void => this.clear();

  readonly requestFrame = (): void => this.restartCapture();

  readonly destroy = (): void => {
    this.closed = true;
    this.clear(true);
  };

  /** Makes this sender's frames the screen's preview. */
  readonly activateMirror = (): void => {
    setNativeMirror(this.screen.id, this.mirrorPump);
  };

  private startUtility(): GpuUtilityProcess {
    const {log, live, runtimeMissing, pixels} = this.options;
    const utility = new GpuUtilityProcess(
      this.screen,
      {probe: pixels !== undefined},
      {
        nativeLoaded: () => log.info('NDI native module loaded'),
        ready: () => {
          this.ready = true;
          this.restartCapture();
        },
        live: () => {
          live();
          if (!pixels) this.activateMirror();
        },
        mirrorFrame: frame => {
          if (frame === null) this.mirrorPump.ack();
          else publishNativeMirror(this.screen.id, frame);
        },
        copied: () => {
          if (!pixels) this.queue.acknowledge();
        },
        pixels: data => {
          pixels?.(data, () => {
            this.queue.acknowledge();
          });
        },
        runtimeMissing: () => {
          this.clear();
          runtimeMissing();
        },
        failed: reason => this.fail(reason),
        exited: code => {
          if (this.utility !== utility) return;
          this.utility = null;
          this.fail(`utility exited ${code}`);
        },
      },
    );
    return utility;
  }

  private postMirror(message: object): void {
    try {
      this.utility?.post(message);
    } catch (error) {
      this.options.log.warn('could not update NDI preview', error);
    }
  }

  /**
   * Stops the utility and lets go of every texture; the window goes too when
   * `destroyWindow`, once the utility is gone.
   */
  private clear(destroyWindow = false): void {
    const {win} = this.window;
    clearNativeMirror(this.screen.id, this.mirrorPump);
    if (this.captureTimeout !== null) clearTimeout(this.captureTimeout);
    this.captureTimeout = null;
    if (!win.isDestroyed()) win.webContents.stopPainting();
    this.health.reset();
    const utility = this.utility;
    this.utility = null;
    this.ready = false;
    this.requireFullFrame = false;
    const outstanding = this.queue.clear();
    const finish = (): void => {
      outstanding?.texture.release();
      if (destroyWindow && !win.isDestroyed()) win.destroy();
    };
    if (utility === null) finish();
    else utility.stop({now: outstanding !== null, exited: finish});
  }

  private fail(reason: unknown): void {
    if (!this.closed) this.options.fallback(reason);
  }

  /**
   * Paints the whole page again into a new texture; a capture that paints no
   * texture within {@link GPU_TIMEOUT_MS} fails.
   */
  private restartCapture(): void {
    const {win} = this.window;
    if (
      this.closed ||
      this.utility === null ||
      !this.ready ||
      win.isDestroyed()
    ) {
      return;
    }
    win.webContents.stopPainting();
    this.requireFullFrame = true;
    this.captureTimeout ??= setTimeout(() => {
      this.captureTimeout = null;
      if (win.isDestroyed() || !win.webContents.isPainting()) return;
      this.options.log.warn('NDI shared texture diagnostics', {
        paintEvents: this.health.paintEvents,
        bitmapPaints: this.health.bitmapPaints,
        gpuCompositing: app.getGPUFeatureStatus().gpu_compositing,
      });
      this.fail('no shared texture paint');
    }, GPU_TIMEOUT_MS);
    win.webContents.startPainting();
  }

  private send(frame: GpuTextureFrame): void {
    if (this.utility === null) {
      this.queue.clear()?.texture.release();
      return;
    }
    const info = frame.texture.textureInfo;
    const handle = info.handle.ntHandle;
    if (handle?.length !== 8) {
      this.fail('unsupported texture handle');
      return;
    }
    this.utility.send({handle, dirty: frame.dirty, format: info.pixelFormat});
  }

  private painted(
    event: {texture?: OffscreenSharedTexture},
    dirty: Rect,
  ): void {
    const texture = event.texture;
    const sending = this.utility !== null && this.ready;
    if (!texture) {
      if (sending && app.getGPUFeatureStatus().gpu_compositing !== 'enabled') {
        this.health.textureMissing(false, Date.now());
        this.fail('GPU compositing is unavailable');
        return;
      }
      if (this.health.textureMissing(sending, Date.now())) {
        this.fail('shared textures stopped arriving');
      }
      return;
    }
    this.health.textureCame();
    if (!sending || this.closed) {
      texture.release();
      return;
    }
    const info = texture.textureInfo;
    if (
      info.handle.ntHandle?.length !== 8 ||
      (info.pixelFormat !== 'bgra' && info.pixelFormat !== 'rgba')
    ) {
      texture.release();
      this.fail('unsupported texture handle or pixel format');
      return;
    }
    if (this.requireFullFrame && !isFullFrame(dirty)) {
      texture.release();
      this.restartCapture();
      return;
    }
    if (!this.queue.busy) this.utility?.idle();
    this.health.textureSent();
    this.requireFullFrame = false;
    if (this.captureTimeout !== null) clearTimeout(this.captureTimeout);
    this.captureTimeout = null;
    this.queue.push({texture, dirty});
  }
}

function isFullFrame(dirty: Rect): boolean {
  return (
    dirty.x === 0 &&
    dirty.y === 0 &&
    dirty.width === NDI_FRAME_WIDTH &&
    dirty.height === NDI_FRAME_HEIGHT
  );
}

/** The NDI output of one screen through shared textures, as a window handle. */
export function createGpuSender(
  initial: OutputScreen,
  events: OutputWindowEvents,
  options: GpuSenderOptions,
): GpuSender {
  const sender = new SharedTextureSender(initial, events, options);
  return {
    ...ndiOutputHandle(sender.window, sender),
    activateMirror: sender.activateMirror,
  };
}
