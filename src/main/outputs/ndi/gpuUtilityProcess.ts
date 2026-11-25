import {utilityProcess, type UtilityProcess} from 'electron';
import {join} from 'node:path';
import type {OutputScreen} from '../screens';
import {ndiSenderEnv, stopSender} from './ndiWindow';
import {NDI_FRAME_HEIGHT, NDI_FRAME_WIDTH} from './textureQueue';

/** How long the utility may take to get ready or to copy a frame, in milliseconds. */
export const GPU_TIMEOUT_MS = 5000;
const GPU_STOP_TIMEOUT_MS = 2000;
const MIRROR_FRAME_BYTES = 640 * 360 * 4;
const FRAME_BYTES = NDI_FRAME_WIDTH * NDI_FRAME_HEIGHT * 4;

/** What the GPU utility process tells its sender. */
export interface GpuUtilityEvents {
  readonly nativeLoaded: () => void;
  /** It can take textures now. */
  readonly ready: () => void;
  /** The first frame went out on the network. */
  readonly live: () => void;
  /** A frame of the small preview, or null when the one it sent was invalid. */
  readonly mirrorFrame: (frame: Uint8Array | null) => void;
  /** The texture on its way was copied. */
  readonly copied: () => void;
  /** A probe's copied frame, as pixels. */
  readonly pixels: (data: Uint8Array) => void;
  readonly runtimeMissing: () => void;
  /** It failed or stopped answering. It keeps running until stopped. */
  readonly failed: (reason: unknown) => void;
  /** It exited by itself; it is gone. */
  readonly exited: (code: number | null) => void;
}

/** One texture on its way to the utility. */
export interface GpuFrameMessage {
  readonly handle: Buffer;
  readonly dirty: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly format: string;
}

/** A message of the GPU utility process. */
interface UtilityMessage {
  readonly type: string;
  readonly message?: string;
  readonly data?: Uint8Array;
  readonly frame?: Uint8Array;
}

/**
 * One GPU utility process that copies shared textures and sends them to NDI,
 * or, as a probe, copies them back as pixels. It owns the process and the
 * watchdog that gives it {@link GPU_TIMEOUT_MS} to get ready and to copy each
 * texture. After {@link stop} it says nothing more.
 */
export class GpuUtilityProcess {
  private readonly worker: UtilityProcess;
  private readonly probe: boolean;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    screen: OutputScreen,
    {probe}: {readonly probe: boolean},
    private readonly events: GpuUtilityEvents,
  ) {
    this.probe = probe;
    this.worker = utilityProcess.fork(
      join(__dirname, 'ndi/gpu-utility.cjs'),
      [],
      {
        serviceName: 'GPU NDI output',
        env: {...ndiSenderEnv(screen), LLP_NDI_PROBE: probe ? '1' : '0'},
      },
    );
    this.watch('GPU utility startup timeout');
    this.worker.on('message', (message: UtilityMessage) => {
      if (!this.stopped) this.onMessage(message);
    });
    this.worker.on('exit', code => {
      if (this.stopped) return;
      this.stopped = true;
      this.clearWatchdog();
      this.events.exited(code);
    });
  }

  /** No texture is on its way: it stops waiting for a copy. */
  idle(): void {
    this.clearWatchdog();
  }

  /** Sends a texture to copy; it fails when no copy comes in time. */
  send({handle, dirty, format}: GpuFrameMessage): void {
    try {
      this.worker.postMessage({
        type: 'frame',
        pid: process.pid,
        handle: handle.readBigUInt64LE(0).toString(16),
        dirty,
        format,
      });
      this.watch('GPU copy timeout');
    } catch (error) {
      this.events.failed(error);
    }
  }

  /** Sends a message about the preview; it throws when the process is gone. */
  post(message: object): void {
    this.worker.postMessage(message);
  }

  /**
   * Stops the process: at once when a texture is still being copied, so it
   * lets go of it. `exited` runs once it is gone. No event follows.
   */
  stop({
    now,
    exited,
  }: {
    readonly now: boolean;
    readonly exited: () => void;
  }): void {
    if (this.stopped) {
      exited();
      return;
    }
    this.stopped = true;
    this.clearWatchdog();
    stopSender(this.worker, {timeoutMs: GPU_STOP_TIMEOUT_MS, now, exited});
  }

  private watch(reason: string): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      this.events.failed(reason);
    }, GPU_TIMEOUT_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private onMessage(message: UtilityMessage): void {
    switch (message.type) {
      case 'native-loaded':
        this.events.nativeLoaded();
        return;
      case 'ready':
        this.clearWatchdog();
        this.events.ready();
        return;
      case 'live':
        this.events.live();
        return;
      case 'mirror-frame':
        this.events.mirrorFrame(
          message.frame instanceof Uint8Array &&
            message.frame.length === MIRROR_FRAME_BYTES
            ? message.frame
            : null,
        );
        return;
      case 'pixels':
        if (!this.probe) return;
        if (
          !(message.data instanceof Uint8Array) ||
          message.data.byteLength !== FRAME_BYTES
        ) {
          this.events.failed('invalid GPU frame');
          return;
        }
        this.events.pixels(message.data);
        return;
      case 'copied':
        this.clearWatchdog();
        this.events.copied();
        return;
      case 'error':
        if (message.message?.includes('NDI_RUNTIME_MISSING')) {
          this.events.runtimeMissing();
        } else this.events.failed(message.message);
        return;
      default:
        // NOTE(0913vision): gpu-utility.cjs sends no other message.
        return;
    }
  }
}
