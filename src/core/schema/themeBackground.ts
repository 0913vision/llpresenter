import * as v from 'valibot';
import {hexColor, jsonObject} from './primitives';
import type {ReadonlyKnown} from './fileFormat';

export const THEME_BACKGROUND_LIMITS = {stops: 4, angle: 359} as const;
const position = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100));

export const themeGradientSchema = jsonObject({
  kind: v.literal('linear'),
  angle: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(THEME_BACKGROUND_LIMITS.angle),
  ),
  mixing: v.literal('oklch'),
  stops: v.pipe(
    v.array(jsonObject({color: hexColor, position})),
    v.minLength(2),
    v.maxLength(THEME_BACKGROUND_LIMITS.stops),
    v.check(
      stops =>
        stops.every(
          (stop, index) =>
            index === 0 || stop.position >= (stops[index - 1]?.position ?? 0),
        ),
      'Expected ascending gradient positions',
    ),
  ),
});

/** Legacy hex colors remain solids; absence of the field inherits the screen. */
export const themeBackgroundSchema = v.union([hexColor, themeGradientSchema]);
export type ThemeGradient = ReadonlyKnown<
  v.InferOutput<typeof themeGradientSchema>
>;
export type ThemeBackground = ReadonlyKnown<
  v.InferOutput<typeof themeBackgroundSchema>
>;
