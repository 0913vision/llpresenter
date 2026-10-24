import * as v from 'valibot';
import {
  hexColor,
  nonBlankText,
  percent,
  positiveInteger,
  positiveNumber,
} from './primitives';

const FONT_WEIGHT_MIN = 1;
const FONT_WEIGHT_MAX = 1000;

/**
 * The text fields that lyric styles, stage layout text, and 소품 text share.
 * Sizes are px on a 1920 x 1080 screen.
 */
export const textStyleEntries = {
  font: nonBlankText,
  weight: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(FONT_WEIGHT_MIN),
    v.maxValue(FONT_WEIGHT_MAX),
  ),
  size: v.pipe(positiveNumber, v.flavor('Pixels')),
  color: hexColor,
  align: v.picklist(['left', 'center']),
  vAlign: v.picklist(['top', 'middle', 'bottom']),
  lineHeight: positiveNumber,
};

/** The fields of a lyric style without its id and name. 소품 text uses them too. */
export const lyricTextEntries = {
  ...textStyleEntries,
  maxLines: positiveInteger,
  margin: percent,
  shadow: v.boolean(),
  outline: v.boolean(),
};
