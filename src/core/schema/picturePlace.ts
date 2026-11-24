import * as v from 'valibot';
import {finiteNumber, jsonObject, positiveNumber} from './primitives';

/**
 * How a picture or a video meets a screen of another shape: 채우기 covers it
 * and cuts what is over, 맞추기 shows all of it, 늘리기 stretches it.
 */
export const pictureFits = ['fill', 'fit', 'stretch'] as const;
export const pictureFitSchema = v.picklist(pictureFits);
export type PictureFit = (typeof pictureFits)[number];

/** Where a picture is and how large, in shares of the screen. */
export const pictureAreaSchema = jsonObject({
  x: finiteNumber,
  y: finiteNumber,
  scale: positiveNumber,
});
export type PictureArea = Readonly<v.InferOutput<typeof pictureAreaSchema>>;

/**
 * The fit and the place of a picture. A slide background and a media item
 * each may have one; what they leave out is the whole screen at 채우기.
 */
export interface PicturePlace {
  readonly fit?: PictureFit;
  readonly area?: PictureArea;
}

/** The place every picture has at first: the whole screen. */
export const WHOLE_AREA: PictureArea = {x: 0, y: 0, scale: 1};

/** Whether a picture is anywhere else than where every picture is at first. */
export function isPlaced({fit, area}: PicturePlace): boolean {
  return area !== undefined || (fit !== undefined && fit !== 'fill');
}
