import * as v from 'valibot';
import {jsonObject} from '../common/primitives';
import type {ReadonlyKnown} from '../common/fileFormat';

/** The length of a transition in seconds, with the step the editor uses. */
export const SLIDE_TRANSITION_LIMITS = {min: 0.1, max: 10, step: 0.01} as const;
/** The kinds of transition: none, dissolve, push, or wipe. */
export const slideTransitionKindSchema = v.picklist([
  'none',
  'dissolve',
  'push',
  'wipe',
]);
/** The direction a push or a wipe moves. */
export const transitionDirectionSchema = v.picklist([
  'left',
  'right',
  'up',
  'down',
]);
/** The length of a transition in seconds, within `SLIDE_TRANSITION_LIMITS`. */
export const slideTransitionSecondsSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(SLIDE_TRANSITION_LIMITS.min),
  v.maxValue(SLIDE_TRANSITION_LIMITS.max),
);

/**
 * A transition: its kind, its length, and a direction that only a push or a
 * wipe may have.
 */
export const slideTransitionSchema = v.pipe(
  jsonObject({
    kind: slideTransitionKindSchema,
    dir: v.exactOptional(transitionDirectionSchema),
    sec: slideTransitionSecondsSchema,
  }),
  v.check(
    value =>
      value.dir === undefined || value.kind === 'push' || value.kind === 'wipe',
    'Only push and wipe have a direction',
  ),
);

/** The transition into a slide, as a slide or 환경설정 stores it. */
export type SlideTransition = ReadonlyKnown<
  v.InferOutput<typeof slideTransitionSchema>
>;
