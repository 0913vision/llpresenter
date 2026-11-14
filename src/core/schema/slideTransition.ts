import * as v from 'valibot';
import {jsonObject} from './primitives';
import type {ReadonlyKnown} from './fileFormat';

export const SLIDE_TRANSITION_LIMITS = {min: 0.1, max: 10, step: 0.01} as const;
export const slideTransitionKindSchema = v.picklist([
  'none',
  'dissolve',
  'push',
  'wipe',
]);
export const transitionDirectionSchema = v.picklist([
  'left',
  'right',
  'up',
  'down',
]);
export const slideTransitionSecondsSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(SLIDE_TRANSITION_LIMITS.min),
  v.maxValue(SLIDE_TRANSITION_LIMITS.max),
);

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

export type SlideTransition = ReadonlyKnown<
  v.InferOutput<typeof slideTransitionSchema>
>;
