/** A width and a height in pixels. */
export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The largest box with the given aspect ratio (width over height) that fits in
 * the available box, scaled uniformly so neither side overflows.
 */
export function fitAspect(available: BoxSize, aspectRatio: number): BoxSize {
  const widthLimited = available.width / aspectRatio;
  return widthLimited <= available.height
    ? {width: available.width, height: widthLimited}
    : {width: available.height * aspectRatio, height: available.height};
}
