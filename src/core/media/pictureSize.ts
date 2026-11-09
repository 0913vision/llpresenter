const SIZE_BUCKET = 32;
const MAX_EDGE = 8192;

/** Rounds physical screen pixels up so nearby layouts share a sharp copy. */
export function pictureBucket(cssPixels: number, pixelRatio: number): number {
  return Math.min(
    MAX_EDGE,
    Math.max(
      SIZE_BUCKET,
      Math.ceil((cssPixels * pixelRatio) / SIZE_BUCKET) * SIZE_BUCKET,
    ),
  );
}

/** Preserves source aspect and enough pixels for cover, including panoramas. */
export function pictureSize(
  source: {readonly width: number; readonly height: number},
  target: {
    readonly width: number;
    readonly height: number;
    readonly fit: string;
  },
): {width: number; height: number} {
  if (target.fit === 'none') return {...source};
  const x = target.width / source.width;
  const y = target.height / source.height;
  if (target.fit === 'fill') {
    return {
      width: Math.min(source.width, target.width),
      height: Math.min(source.height, target.height),
    };
  }
  const scale = Math.min(
    1,
    target.fit === 'cover' ? Math.max(x, y) : Math.min(x, y),
  );
  return {
    width: Math.max(1, Math.ceil(source.width * scale)),
    height: Math.max(1, Math.ceil(source.height * scale)),
  };
}
