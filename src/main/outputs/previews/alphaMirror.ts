import {Worker} from 'node:worker_threads';
import type {Logger} from '../../base/log';

const WIDTH = 640;
const HEIGHT = 360;
const INTERVAL_MS = 100;

function createConverter(): (source: Uint8Array) => Uint8Array {
  const table = Uint8Array.from({length: 256 * 256}, (_, index) => {
    const alpha = index >>> 8;
    const value = index & 255;
    return alpha === 0 ? 0 : Math.min(255, Math.round((value * 255) / alpha));
  });
  return source => {
    const target = new Uint8Array(source.length);
    for (let i = 0; i < source.length; i += 4) {
      const alpha = source[i + 3] ?? 0;
      if (alpha === 0) continue;
      const base = alpha << 8;
      target[i] = table[base + (source[i + 2] ?? 0)] ?? 0;
      target[i + 1] = table[base + (source[i + 1] ?? 0)] ?? 0;
      target[i + 2] = table[base + (source[i] ?? 0)] ?? 0;
      target[i + 3] = alpha;
    }
    return target;
  };
}

/** Converts Electron's premultiplied BGRA bitmap to canvas RGBA. */
export function unpremultiplyBgra(source: Uint8Array): Uint8Array {
  return createConverter()(source);
}

interface PaintImage {
  isEmpty(): boolean;
  getSize(): {width: number; height: number};
  resize(options: {width: number; height: number; quality: 'good'}): {
    toBitmap(): Uint8Array;
  };
}

type PaintListener = (
  event: unknown,
  dirty: unknown,
  image: PaintImage | undefined,
) => void;
interface PaintSource {
  isDestroyed(): boolean;
  on(event: 'paint', listener: PaintListener): unknown;
  removeListener(event: 'paint', listener: PaintListener): unknown;
  invalidate(): void;
}

interface ConvertedFrame {
  readonly frame: Uint8Array;
  readonly generation: number;
}

/** A preview bitmap to convert, scaled to fit inside the preview size. */
interface PreviewBitmap {
  readonly data: Uint8Array<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
  readonly generation: number;
}

/** The worker's code: converts a bitmap and centers it on a transparent preview frame. */
const CONVERTER_SCRIPT = `
      const {parentPort} = require('node:worker_threads');
      const convert = (${createConverter.toString()})();
      parentPort.on('message', ({data, width, height, generation}) => {
        const pixels = convert(data);
        const frame = new Uint8Array(${WIDTH * HEIGHT * 4});
        const left = Math.floor((${WIDTH} - width) / 2);
        const top = Math.floor((${HEIGHT} - height) / 2);
        for (let y = 0; y < height; y++) {
          frame.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), ((top + y) * ${WIDTH} + left) * 4);
        }
        parentPort.postMessage({frame, generation}, [frame.buffer]);
      });
      `;

/**
 * Converts preview bitmaps away from the main process, one at a time, in one
 * worker it makes at the first bitmap and again after the worker failed or
 * ended.
 */
class PreviewConverter {
  private worker: Worker | undefined;
  /** A bitmap is being converted now. */
  converting = false;

  constructor(
    private readonly events: {
      /** The worker failed; the next bitmap makes a new one. */
      readonly failed: (error: unknown) => void;
      /** The worker ended or failed with no bitmap on its way. */
      readonly idle: () => void;
    },
  ) {}

  convert(
    bitmap: PreviewBitmap,
    deliver: (result: ConvertedFrame) => void,
  ): void {
    const worker = this.worker ?? this.start();
    const done = (result: ConvertedFrame): void => {
      this.converting = false;
      deliver(result);
    };
    worker.once('message', done);
    this.converting = true;
    try {
      worker.postMessage(bitmap, [bitmap.data.buffer]);
    } catch (error) {
      worker.off('message', done);
      this.converting = false;
      throw error;
    }
  }

  stop(): void {
    this.worker?.terminate().catch(() => undefined);
    this.worker = undefined;
  }

  private start(): Worker {
    const created = new Worker(CONVERTER_SCRIPT, {eval: true});
    created.on('error', error => {
      this.converting = false;
      if (this.worker === created) this.worker = undefined;
      this.events.failed(error);
    });
    created.on('exit', () => {
      if (this.worker !== created) return;
      this.worker = undefined;
      this.converting = false;
      this.events.idle();
    });
    this.worker = created;
    return created;
  }
}

/** Reuses output paint images, with conversion away from the main process. */
export function createAlphaMirror(options: AlphaMirrorOptions): {
  ack(): void;
  stop(): void;
} {
  const mirror = new AlphaMirror(options);
  return {ack: () => mirror.ack(), stop: () => mirror.stop()};
}

interface AlphaMirrorOptions {
  readonly source: () => PaintSource | null;
  readonly send: (frame: Uint8Array) => void;
  readonly outputActive: () => boolean;
  readonly log: Pick<Logger, 'warn'>;
}

/**
 * The 방송 preview of a transparent output: it follows the output's paints,
 * keeps only the newest image, and sends one converted frame at a time, at
 * most every {@link INTERVAL_MS}, the next only after the last was taken.
 */
class AlphaMirror {
  private active = true;
  private watched: PaintSource | null = null;
  /** The newest paint not yet converted. */
  private latest: PaintImage | undefined;
  /** A frame was sent and the preview hasn't taken it yet. */
  private inFlight = false;
  /** When the next frame may go. */
  private due = 0;
  /** Counts the outputs followed, so a frame made for an earlier one is dropped. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly reported = new Set<string>();
  private readonly converter = new PreviewConverter({
    failed: error => {
      this.report('the NDI preview converter failed', error);
      this.schedule();
    },
    idle: () => this.schedule(),
  });
  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor(private readonly options: AlphaMirrorOptions) {
    this.heartbeat = setInterval(() => this.watch(), 500);
    this.watch();
  }

  ack(): void {
    if (!this.active || !this.inFlight) return;
    this.inFlight = false;
    this.schedule();
  }

  stop(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    this.detach();
    this.converter.stop();
  }

  /** Logs each kind of failure once, so a failure on every paint can't fill the log. */
  private report(message: string, error: unknown): void {
    if (this.reported.has(message)) return;
    this.reported.add(message);
    this.options.log.warn(message, error);
  }

  private get running(): boolean {
    return this.active && this.options.outputActive();
  }

  private readonly onPaint: PaintListener = (_event, _dirty, image) => {
    if (!this.running || !image || image.isEmpty()) return;
    this.latest = image;
    this.schedule();
  };

  private schedule(): void {
    if (!this.running) return;
    if (
      this.inFlight ||
      this.converter.converting ||
      !this.latest ||
      this.timer
    ) {
      return;
    }
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        try {
          this.produce();
        } catch (error) {
          this.report('could not make an NDI preview frame', error);
          this.schedule();
        }
      },
      Math.max(0, this.due - performance.now()),
    );
  }

  private detach(): void {
    this.watched?.removeListener('paint', this.onPaint);
    this.watched = null;
    this.latest = undefined;
    this.inFlight = false;
    this.generation++;
  }

  /** Follows the output page shown now, and none while the output is off. */
  private watch(): void {
    const next = this.options.outputActive() ? this.options.source() : null;
    if (next === this.watched) return;
    this.detach();
    if (next && !next.isDestroyed()) {
      this.watched = next;
      next.on('paint', this.onPaint);
      try {
        next.invalidate();
      } catch {
        // NOTE(0913vision): The output can close while the preview attaches.
      }
    }
  }

  private produce(): void {
    if (!this.running) return;
    if (this.inFlight || this.converter.converting || !this.latest) return;
    const image = this.latest;
    this.latest = undefined;
    const size = image.getSize();
    if (size.width <= 0 || size.height <= 0) return;
    const scale = Math.min(WIDTH / size.width, HEIGHT / size.height);
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    const bitmap = image.resize({width, height, quality: 'good'}).toBitmap();
    if (bitmap.length !== width * height * 4) return;
    const generation = this.generation;
    this.converter.convert(
      {data: new Uint8Array(bitmap), width, height, generation},
      result => {
        if (this.running && result.generation === this.generation) {
          this.inFlight = true;
          this.due = performance.now() + INTERVAL_MS;
          this.options.send(result.frame);
        } else this.schedule();
      },
    );
  }
}
