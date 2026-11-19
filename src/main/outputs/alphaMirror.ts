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
}: {
  readonly source: () => {
    isDestroyed(): boolean;
    capturePage(): Promise<{
      isEmpty(): boolean;
      getSize(): {width: number; height: number};
      resize(options: {width: number; height: number; quality: 'good'}): {
        toBitmap(): Uint8Array;
      };
    }>;
  } | null;
  readonly send: (frame: Uint8Array) => void;
}): {ack(): void; stop(): void} {
  let active = true;
  let generation = 0;
  let inFlight = false;
  let due = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (delay: number): void => {
    if (!active || inFlight || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      capture().catch(() => schedule(500));
    }, delay);
  };
  const capture = async (): Promise<void> => {
    if (!active || inFlight) return;
    const contents = source();
    if (contents === null || contents.isDestroyed()) {
      schedule(500);
      return;
    }
    due = performance.now() + INTERVAL_MS;
    const own = generation;
    const image = await contents.capturePage();
    if (own !== generation) return;
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
  schedule(0);
  return {
    ack: () => {
      if (!active || !inFlight) return;
      inFlight = false;
      schedule(Math.max(0, due - performance.now()));
    },
    stop: () => {
      active = false;
      generation++;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
