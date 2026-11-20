import {Worker} from 'node:worker_threads';

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
}

/** Reuses output paint images, with conversion away from the main process. */
export function createAlphaMirror({
  source,
  send,
  outputActive,
}: {
  readonly source: () => PaintSource | null;
  readonly send: (frame: Uint8Array) => void;
  readonly outputActive: () => boolean;
}): {ack(): void; stop(): void} {
  let active = true;
  let watched: PaintSource | null = null;
  let latest: PaintImage | undefined;
  let inFlight = false;
  let converting = false;
  let due = 0;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let worker: Worker | undefined;

  const schedule = (): void => {
    if (!active || !outputActive()) return;
    if (inFlight || converting || !latest || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      try {
        produce();
      } catch {
        converting = false;
        schedule();
      }
    }, Math.max(0, due - performance.now()));
  };
  const onPaint: PaintListener = (_event, _dirty, image) => {
    if (!active || !outputActive() || !image || image.isEmpty()) return;
    latest = image;
    schedule();
  };
  const detach = (): void => {
    watched?.removeListener('paint', onPaint);
    watched = null;
    latest = undefined;
    inFlight = false;
    generation++;
  };
  const watch = (): void => {
    const next = outputActive() ? source() : null;
    if (next === watched) return;
    detach();
    if (next && !next.isDestroyed()) {
      watched = next;
      next.on('paint', onPaint);
    }
  };
  const produce = (): void => {
    if (!active || !outputActive()) return;
    if (inFlight || converting || !latest) return;
    const image = latest;
    latest = undefined;
    const size = image.getSize();
    if (size.width <= 0 || size.height <= 0) return;
    const scale = Math.min(WIDTH / size.width, HEIGHT / size.height);
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    const bitmap = image.resize({width, height, quality: 'good'}).toBitmap();
    if (bitmap.length !== width * height * 4) return;
    if (worker === undefined) {
      const created = new Worker(
        `
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
      `,
        {eval: true},
      );
      created.on('error', () => {
        converting = false;
        if (worker === created) worker = undefined;
        schedule();
      });
      created.on('exit', () => {
        if (worker !== created) return;
        worker = undefined;
        converting = false;
        schedule();
      });
      worker = created;
    }
    const deliver = (result: {frame: Uint8Array; generation: number}): void => {
      converting = false;
      if (active && outputActive() && result.generation === generation) {
        inFlight = true;
        due = performance.now() + INTERVAL_MS;
        send(result.frame);
      } else schedule();
    };
    worker.once('message', deliver);
    const data = new Uint8Array(bitmap);
    converting = true;
    worker.postMessage({data, width, height, generation}, [data.buffer]);
  };
  const heartbeat = setInterval(watch, 500);
  watch();
  return {
    ack: () => {
      if (!active || !inFlight) return;
      inFlight = false;
      schedule();
    },
    stop: () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(heartbeat);
      detach();
      worker?.terminate().catch(() => undefined);
      worker = undefined;
    },
  };
}
