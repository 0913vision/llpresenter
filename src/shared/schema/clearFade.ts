import * as v from 'valibot';
import {layerKinds} from '../live';
import {MAX_ACTIVE_PROPS} from './overlayState';
import {propIdSchema} from './ids';
import {plainObject, payloadObject} from './payload';

export const CLEAR_FADE_LIMIT_MS = 30_000;
export const clearKeyTargets = ['all', ...layerKinds] as const;
export const DEFAULT_CLEAR_FADE = {fade: false, durationMs: 500} as const;
export const clearFadeSchema = v.looseObject({
  fade: v.optional(v.boolean(), DEFAULT_CLEAR_FADE.fade),
  durationMs: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.maxValue(CLEAR_FADE_LIMIT_MS),
    ),
    DEFAULT_CLEAR_FADE.durationMs,
  ),
});
export type ClearFade = Readonly<v.InferOutput<typeof clearFadeSchema>>;

const effectTargetSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('layer'), layer: v.picklist(layerKinds)}),
    v.object({kind: v.literal('prop'), propId: propIdSchema}),
  ]),
);
export const clearEffectsSchema = v.pipe(
  v.array(
    payloadObject({
      target: effectTargetSchema,
      since: v.pipe(v.number(), v.finite(), v.minValue(0)),
      durationMs: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.maxValue(CLEAR_FADE_LIMIT_MS),
      ),
    }),
  ),
  v.maxLength(MAX_ACTIVE_PROPS + layerKinds.length),
);
export type ClearEffect = Readonly<
  v.InferOutput<typeof clearEffectsSchema>[number]
>;
