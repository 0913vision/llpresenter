import type {NativeImage, Rectangle} from 'electron';
import type {Logger} from '../../base/log';
import type {OutputScreen} from '../screens';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import {BitmapSenderProcess} from './bitmapSenderProcess';
import {
  applyNdiSettings,
  createNdiWindow,
  ndiOutputHandle,
  type NdiSender,
  type NdiWindow,
} from './ndiWindow';
import {unionDirty} from './rect';
import {NDI_FRAME_HEIGHT, NDI_FRAME_WIDTH} from './textureQueue';

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

/** What a bitmap output reports. */
interface BitmapOutputOptions {
  readonly log: Logger;
  readonly onFailure: (id: string, missing: boolean) => void;
}

/** A painted area that waits to go, merged with the ones before it. */
interface WaitingPaint {
  readonly dirty: Rectangle;
  readonly image: NativeImage;
}

/** A frame of a GPU capture that waits to go, and how it is handed back. */
interface WaitingGpuFrame {
  readonly data: Uint8Array;
  readonly done: (sent: boolean) => void;
}

const GPU_FRAME_BYTES = NDI_FRAME_WIDTH * NDI_FRAME_HEIGHT * 4;

/**
 * Sends one screen's page to NDI as bitmaps: an offscreen window paints, and a
 * {@link BitmapSenderProcess} sends each changed area, one frame at a time. A
 * paint that comes while a frame is on its way joins the next one. A GPU output
 * that fell back hands its pixels in instead of the paints. A sender that
 * fails is a failure of the screen.
 */
class BitmapOutput implements NdiSender {
  private screen: OutputScreen;
  private sender: BitmapSenderProcess | null = null;
  private closed = false;
  /** While a GPU capture hands its pixels in, the window's paints are not sent. */
  private gpuInput = false;
  /** Whether a frame is on its way; one goes at a time. */
  private sending = false;
  private waitingPaint: WaitingPaint | null = null;
  private waitingGpu: WaitingGpuFrame | null = null;
  /** Hands back the GPU frame on its way once it went out or was dropped. */
  private gpuOnItsWay: ((sent: boolean) => void) | null = null;

  constructor(
    private readonly window: NdiWindow,
    screen: OutputScreen,
    private readonly options: BitmapOutputOptions,
  ) {
    this.screen = screen;
    window.win.webContents.on('paint', (_event, dirty, image) => {
      this.painted(dirty, image);
    });
  }

  readonly configure = (next: OutputScreen): void => {
    const restart = applyNdiSettings(this.window.win, this.screen, next);
    this.screen = next;
    if (restart && this.sender !== null) {
      this.stop();
      this.begin();
    }
  };

  readonly begin = (): void => {
    if (this.closed || this.sender !== null) return;
    this.sender = new BitmapSenderProcess(
      this.screen,
      {
        ready: () => {
          this.window.win.webContents.invalidate();
          this.sendGpu();
        },
        sent: () => this.frameSent(),
        failed: missing => {
          this.letGo();
          this.options.onFailure(this.screen.id, missing);
        },
      },
      this.options.log,
    );
  };

  readonly stop = (): void => {
    const sender = this.sender;
    this.letGo();
    sender?.stop();
  };

  readonly requestFrame = (): void => {
    this.window.win.webContents.invalidate();
  };

  readonly destroy = (): void => {
    this.closed = true;
    this.stop();
    if (!this.window.win.isDestroyed()) this.window.win.destroy();
  };

  setGpuInput(enabled: boolean): void {
    this.gpuInput = enabled;
    this.waitingPaint = null;
    if (enabled) return;
    const waiting = this.waitingGpu;
    this.waitingGpu = null;
    waiting?.done(false);
    this.window.win.webContents.invalidate();
  }

  submitGpuPixels(data: Uint8Array, done: (sent: boolean) => void): void {
    if (data.byteLength !== GPU_FRAME_BYTES) {
      done(false);
      return;
    }
    const replaced = this.waitingGpu;
    this.waitingGpu = {data, done};
    replaced?.done(false);
    this.sendGpu();
  }

  /** Forgets the sender and every frame, handing back the GPU frames unsent. */
  private letGo(): void {
    this.sender = null;
    this.sending = false;
    this.waitingPaint = null;
    const waiting = this.waitingGpu;
    const onItsWay = this.gpuOnItsWay;
    this.waitingGpu = null;
    this.gpuOnItsWay = null;
    waiting?.done(false);
    onItsWay?.(false);
  }

  private painted(dirty: Rectangle, image: NativeImage): void {
    if (
      this.sender?.isReady !== true ||
      this.closed ||
      this.gpuInput ||
      dirty.width <= 0 ||
      dirty.height <= 0
    ) {
      return;
    }
    const size = image.getSize();
    if (size.width !== NDI_FRAME_WIDTH || size.height !== NDI_FRAME_HEIGHT) {
      return;
    }
    if (!this.sending) {
      this.sendPaint({dirty, image});
      return;
    }
    const previous = this.waitingPaint?.dirty;
    this.waitingPaint = {
      image,
      dirty: previous === undefined ? dirty : unionDirty(previous, dirty),
    };
  }

  private sendPaint({dirty, image}: WaitingPaint): void {
    if (this.sender === null) return;
    this.sending = true;
    this.sender.send({...dirty, data: image.crop(dirty).toBitmap()});
  }

  private sendGpu(): void {
    const next = this.waitingGpu;
    if (
      !this.gpuInput ||
      next === null ||
      this.sender?.isReady !== true ||
      this.sending
    ) {
      return;
    }
    this.waitingGpu = null;
    this.gpuOnItsWay = next.done;
    this.sending = true;
    this.sender.send({
      x: 0,
      y: 0,
      width: NDI_FRAME_WIDTH,
      height: NDI_FRAME_HEIGHT,
      data: Buffer.from(next.data),
    });
  }

  /** A frame went out: the next one that waits goes. */
  private frameSent(): void {
    this.sending = false;
    const done = this.gpuOnItsWay;
    this.gpuOnItsWay = null;
    done?.(true);
    if (this.gpuInput) {
      this.sendGpu();
      return;
    }
    const paint = this.waitingPaint;
    this.waitingPaint = null;
    if (paint !== null) this.sendPaint(paint);
  }
}

/** Creates an NDI output that sends its page as bitmaps. */
export function createBitmapOutput(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: BitmapOutputOptions,
): BitmapSender {
  const window = createNdiWindow(screen, events, {
    sharedTexture: false,
    onLoadError: error => options.log.error('could not load NDI output', error),
  });
  const output = new BitmapOutput(window, screen, options);
  return {
    ...ndiOutputHandle(window, output),
    setGpuInput: enabled => output.setGpuInput(enabled),
    submitGpuPixels: (data, done) => output.submitGpuPixels(data, done),
  };
}
