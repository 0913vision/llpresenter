import * as v from 'valibot';
import {layerKinds} from './live';
import {MAX_ACTIVE_PROPS} from './overlayState';
import {propIdSchema} from '../common/ids';
import {plainObject, payloadObject} from '../common/payload';
import {jsonObject} from '../common/primitives';

/** The longest fade of a clear, in milliseconds. */
export const CLEAR_FADE_LIMIT_MS = 30_000;
/** How many fades can run at once: one for each active prop and each layer. */
export const MAX_CLEAR_EFFECTS = MAX_ACTIVE_PROPS + layerKinds.length;
/**
 * The clear that is not asked to fade: it cuts at once, and a fade asked for
 * without a duration takes 500 milliseconds.
 */
export const DEFAULT_CLEAR_FADE = {fade: false, durationMs: 500} as const;
/**
 * How a clear takes its content off: whether it fades, and for how many
 * milliseconds (0 to 30 000).
 */
export const clearFadeSchema = jsonObject({
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
/**
 * How a clear takes its content off, with the defaults of `DEFAULT_CLEAR_FADE`
 * filled in.
 */
export type ClearFade = Readonly<v.InferOutput<typeof clearFadeSchema>>;

const effectTargetSchema = v.pipe(
  plainObject,
  v.variant('kind', [
    v.object({kind: v.literal('layer'), layer: v.picklist(layerKinds)}),
    v.object({kind: v.literal('prop'), propId: propIdSchema}),
  ]),
);
/**
 * The fades that are running: the layer or prop that fades, when it began on
 * the main clock, and its length in milliseconds (1 to 30 000).
 */
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
  v.maxLength(MAX_CLEAR_EFFECTS),
);
/** One running fade of a cleared layer or prop. */
export type ClearEffect = Readonly<
  v.InferOutput<typeof clearEffectsSchema>[number]
>;
