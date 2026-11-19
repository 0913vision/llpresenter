const WIDTH = 640;
const HEIGHT = 360;
const INTERVAL_MS = 50;
const unpremultiply = Uint8Array.from({length: 256 * 256}, (_, index) => {
  const alpha = index >>> 8;
  const value = index & 255;
  return alpha === 0 ? 0 : Math.min(255, Math.round((value * 255) / alpha));
});

/** Converts Electron's premultiplied BGRA bitmap to canvas RGBA. */
export function unpremultiplyBgra(source: Uint8Array): Uint8Array {
  const target = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i += 4) {
    const alpha = source[i + 3] ?? 0;
    if (alpha === 0) continue;
    if (alpha === 255) {
      target[i] = source[i + 2] ?? 0;
      target[i + 1] = source[i + 1] ?? 0;
      target[i + 2] = source[i] ?? 0;
      target[i + 3] = alpha;
      continue;
    }
    const base = alpha << 8;
    target[i] = unpremultiply[base + (source[i + 2] ?? 0)] ?? 0;
    target[i + 1] = unpremultiply[base + (source[i + 1] ?? 0)] ?? 0;
    target[i + 2] = unpremultiply[base + (source[i] ?? 0)] ?? 0;
    target[i + 3] = alpha;
  }
  return target;
}

/** Samples the existing transparent NDI output, with one frame in flight. */
export function createAlphaMirror({
  source,
  send,
  outputActive = () => false,
}: {
  readonly source: () => {
    isDestroyed(): boolean;
    isPainting?(): boolean;
    startPainting?(): void;
    stopPainting?(): void;
    on?(event: 'paint', listener: () => void): unknown;
    removeListener?(event: 'paint', listener: () => void): unknown;
    capturePage(): Promise<{
      isEmpty(): boolean;
      getSize(): {width: number; height: number};
      resize(options: {width: number; height: number; quality: 'good'}): {
        toBitmap(): Uint8Array;
      };
    }>;
  } | null;
  readonly send: (frame: Uint8Array) => void;
  readonly outputActive?: () => boolean;
}): {ack(): void; stop(): void} {
  let active = true;
  let generation = 0;
  let inFlight = false;
  let capturing = false;
  let due = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watched: ReturnType<typeof source> = null;
  let paintingForPreview = false;
  let dirty = true;
  const onPaint = (): void => {
    dirty = true;
    schedule(Math.max(0, due - performance.now()));
  };
  const detach = (): void => {
    watched?.removeListener?.('paint', onPaint);
    if (
      paintingForPreview &&
      watched &&
      !watched.isDestroyed() &&
      !outputActive()
    ) {
      watched.stopPainting?.();
    }
    watched = null;
    paintingForPreview = false;
  };
  const watch = (): void => {
    const next = source();
    if (next !== watched) {
      detach();
      generation++;
      watched = next;
      watched?.on?.('paint', onPaint);
      dirty = true;
      schedule(0);
    }
    if (watched && !watched.isDestroyed() && watched.isPainting?.() === false) {
      watched.startPainting?.();
      paintingForPreview = true;
      dirty = true;
      schedule(0);
    }
  };
  const schedule = (delay: number): void => {
    if (!active || inFlight || capturing || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      capture().catch(() => schedule(500));
    }, delay);
  };
  const capture = async (): Promise<void> => {
    if (!active || inFlight || capturing) return;
    watch();
    const contents = watched;
    if (contents === null || contents.isDestroyed()) {
      schedule(500);
      return;
    }
    dirty = false;
    due = performance.now() + INTERVAL_MS;
    const own = generation;
    capturing = true;
    let image: Awaited<ReturnType<typeof contents.capturePage>>;
    try {
      image = await contents.capturePage();
    } finally {
      capturing = false;
    }
    if (own !== generation) {
      schedule(0);
      return;
    }
    if (image.isEmpty()) {
      schedule(500);
      return;
    }
    const size = image.getSize();
    if (size.width <= 0 || size.height <= 0) {
      schedule(500);
      return;
    }
    const scale = Math.min(WIDTH / size.width, HEIGHT / size.height);
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    const pixels = image.resize({width, height, quality: 'good'}).toBitmap();
    if (pixels.length !== width * height * 4) {
      schedule(500);
      return;
    }
    const converted = unpremultiplyBgra(pixels);
    let frame = converted;
    if (width !== WIDTH || height !== HEIGHT) {
      frame = new Uint8Array(WIDTH * HEIGHT * 4);
      const left = Math.floor((WIDTH - width) / 2);
      const top = Math.floor((HEIGHT - height) / 2);
      for (let y = 0; y < height; y++) {
        frame.set(
          converted.subarray(y * width * 4, (y + 1) * width * 4),
          ((top + y) * WIDTH + left) * 4,
        );
      }
    }
    inFlight = true;
    send(frame);
  };
  const heartbeat = setInterval(watch, 500);
  watch();
  schedule(0);
  return {
    ack: () => {
      if (!active || !inFlight) return;
      inFlight = false;
      if (dirty || watched?.on === undefined) {
        schedule(Math.max(0, due - performance.now()));
      }
    },
    stop: () => {
      active = false;
      generation++;
      if (timer !== undefined) clearTimeout(timer);
      clearInterval(heartbeat);
      detach();
      timer = undefined;
    },
  };
}
