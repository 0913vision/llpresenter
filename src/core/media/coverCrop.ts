/** A size in pixels. */
export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/** A part of a picture, in its pixels. */
export interface Crop extends PixelSize {
  readonly x: number;
  readonly y: number;
}

/**
 * The middle of a picture with the target's aspect ratio, which covers the
 * target like `object-fit: cover`, as the media tiles show thumbnails.
 */
export function coverCrop(picture: PixelSize, target: PixelSize): Crop {
  const scale = Math.max(
    target.width / picture.width,
    target.height / picture.height,
  );
  const width = Math.min(picture.width, target.width / scale);
  const height = Math.min(picture.height, target.height / scale);
  return {
    x: (picture.width - width) / 2,
    y: (picture.height - height) / 2,
    width,
    height,
  };
}
