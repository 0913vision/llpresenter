import * as v from 'valibot';
import {hexColor, jsonObject, nonNegativeNumber, percent} from './primitives';

/** The ranges of the outline and shadow that a text style may use. */
export const LYRIC_EFFECT_LIMITS = {
  outlineWidth: {min: 1, max: 10},
  shadowBlur: 40,
  shadowDistance: 20,
  shadowAngle: 360,
} as const;

export const lyricOutlineSchema = jsonObject({
  on: v.boolean(),
  width: v.pipe(
    nonNegativeNumber,
    v.minValue(LYRIC_EFFECT_LIMITS.outlineWidth.min),
    v.maxValue(LYRIC_EFFECT_LIMITS.outlineWidth.max),
  ),
  color: hexColor,
});

export const lyricShadowSchema = jsonObject({
  on: v.boolean(),
  blur: v.pipe(nonNegativeNumber, v.maxValue(LYRIC_EFFECT_LIMITS.shadowBlur)),
  distance: v.pipe(
    nonNegativeNumber,
    v.maxValue(LYRIC_EFFECT_LIMITS.shadowDistance),
  ),
  angle: v.pipe(nonNegativeNumber, v.maxValue(LYRIC_EFFECT_LIMITS.shadowAngle)),
  opacity: percent,
  color: hexColor,
});

export type LyricOutline = v.InferOutput<typeof lyricOutlineSchema>;
export type LyricShadow = v.InferOutput<typeof lyricShadowSchema>;
