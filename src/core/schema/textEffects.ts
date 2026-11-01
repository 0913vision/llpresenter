import * as v from 'valibot';
import {hexColor, jsonObject, nonNegativeNumber, percent} from './primitives';

/** The ranges of the outline and shadow that a text style may use. */
export const TEXT_EFFECT_LIMITS = {
  outlineWidth: {min: 1, max: 10},
  shadowBlur: 40,
  shadowDistance: 20,
  shadowAngle: 360,
} as const;

export const textOutlineSchema = jsonObject({
  on: v.boolean(),
  width: v.pipe(
    nonNegativeNumber,
    v.minValue(TEXT_EFFECT_LIMITS.outlineWidth.min),
    v.maxValue(TEXT_EFFECT_LIMITS.outlineWidth.max),
  ),
  color: hexColor,
});

export const textShadowSchema = jsonObject({
  on: v.boolean(),
  blur: v.pipe(nonNegativeNumber, v.maxValue(TEXT_EFFECT_LIMITS.shadowBlur)),
  distance: v.pipe(
    nonNegativeNumber,
    v.maxValue(TEXT_EFFECT_LIMITS.shadowDistance),
  ),
  angle: v.pipe(nonNegativeNumber, v.maxValue(TEXT_EFFECT_LIMITS.shadowAngle)),
  opacity: percent,
  color: hexColor,
});

export type TextOutline = v.InferOutput<typeof textOutlineSchema>;
export type TextShadow = v.InferOutput<typeof textShadowSchema>;
