import * as v from 'valibot';
import {quickItemIdSchema, timerIdSchema} from './ids';
import type {ReadonlyKnown} from './fileFormat';
import {MAX_TIMER_SECONDS} from './timers';

export const MAX_TIMER_DEFINITIONS = 500;
export const TIMER_NAME_LIMIT = 256;
export {MAX_TIMER_SECONDS} from './timers';

export const quickTimerCreateSchema = v.pipe(
  v.object({
    type: v.literal('quick.timer.create'),
    name: v.literal('quick'),
    quickItemId: quickItemIdSchema,
    timerId: timerIdSchema,
    duration: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(MAX_TIMER_SECONDS),
    ),
  }),
  v.check(
    edit => String(edit.quickItemId) !== edit.timerId,
    'Expected distinct IDs',
  ),
);

export const quickTimerRenameSchema = v.object({
  type: v.literal('quick.timer.rename'),
  name: v.literal('quick'),
  quickItemId: quickItemIdSchema,
  timerName: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.maxLength(TIMER_NAME_LIMIT),
  ),
});

export const quickTimersSeparateSchema = v.object({
  type: v.literal('quick.timers.separate'),
  name: v.literal('quick'),
});

export type QuickTimerEdit = ReadonlyKnown<
  v.InferOutput<
    | typeof quickTimerCreateSchema
    | typeof quickTimerRenameSchema
    | typeof quickTimersSeparateSchema
  >
>;
