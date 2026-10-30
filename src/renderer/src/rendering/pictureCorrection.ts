import type {PictureCorrection} from './layer';

/** The custom property on the renderer root that every layer box's transform reads. */
export const PICTURE_TRANSFORM = '--picture-transform';

/**
 * The CSS transform of a corrected picture: 가장자리 여백 m % scales it to
 * (100 - 2m) % around the centre, then 위치 미세 조정 moves it by the offset
 * in reference px, scaled like lyric sizes (docs/spec/03-output.md).
 *
 * @param scale - CSS px per reference px on the drawn picture.
 * @returns The transform, or null when the picture covers the screen as is.
 */
export function pictureTransform(
  {edgeMargin, offset}: PictureCorrection,
  scale: number,
): string | null {
  const size = Math.max(0, 1 - (2 * edgeMargin) / 100);
  const x = offset.x * scale;
  const y = offset.y * scale;
  if (size === 1 && x === 0 && y === 0) return null;
  return `translate(${x}px, ${y}px) scale(${size})`;
}
