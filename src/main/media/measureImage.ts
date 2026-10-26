import {nativeImage} from 'electron';
import {coverCrop, type PixelSize} from '@shared/coverCrop';
import type {MediaFacts} from './mediaAnalyser';

/** The JPEG quality of thumbnails drawn in main, from 0 to 100. */
export const THUMBNAIL_JPEG_QUALITY = 80;

/**
 * Measures an image with Electron's `nativeImage` and draws the middle of it
 * as a thumbnail when one is asked for (`docs/decisions.md`, "Media analysis
 * runs in a hidden renderer").
 *
 * @returns Null when `nativeImage` can't read the image, such as a WebP file,
 * which the analysis page reads instead.
 */
export function measureImage(
  file: string,
  thumbnail: PixelSize | null,
): MediaFacts | null {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return null;
  const {width, height} = image.getSize();
  if (thumbnail === null) return {width, height};
  const crop = coverCrop({width, height}, thumbnail);
  const drawn = image
    .crop({
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.max(1, Math.round(crop.width)),
      height: Math.max(1, Math.round(crop.height)),
    })
    .resize({...thumbnail, quality: 'good'});
  return {width, height, thumbnail: drawn.toJPEG(THUMBNAIL_JPEG_QUALITY)};
}
