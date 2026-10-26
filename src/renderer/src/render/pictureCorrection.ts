import type {PictureCorrection} from './layer';

/** The CSS size of the surface the picture is drawn on. */
export interface Surface {
  readonly width: number;
  readonly height: number;
  /** Device pixels per CSS pixel. */
  readonly pixelRatio: number;
}

function cssPerPixel(
  cssLength: number,
  pixels: number | undefined,
  ratio: number,
): number {
  return pixels === undefined ? 1 / ratio : cssLength / pixels;
}

/**
 * The CSS transform of a corrected picture: 가장자리 여백 m % scales it to
 * (100 - 2m) % around the centre, then 위치 미세 조정 moves it by the offset
 * in the screen's own pixels, converted to the surface's CSS pixels.
 *
 * @returns The transform, or null when the picture covers the screen as is.
 */
export function pictureTransform(
  {edgeMargin, offset, pixels}: PictureCorrection,
  surface: Surface,
): string | null {
  const scale = Math.max(0, 1 - (2 * edgeMargin) / 100);
  const x =
    offset.x * cssPerPixel(surface.width, pixels?.width, surface.pixelRatio);
  const y =
    offset.y * cssPerPixel(surface.height, pixels?.height, surface.pixelRatio);
  if (scale === 1 && x === 0 && y === 0) return null;
  return `translate(${x}px, ${y}px) scale(${scale})`;
}
