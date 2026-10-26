import * as v from 'valibot';
import {quickItemIdSchema, timerIdSchema} from './ids';
import type {ReadonlyKnown} from './fileFormat';

export const MAX_TIMER_DEFINITIONS = 500;
export const TIMER_NAME_LIMIT = 256;
export const MAX_TIMER_SECONDS = Math.floor(Number.MAX_SAFE_INTEGER / 1000);

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

export type QuickTimerEdit = ReadonlyKnown<
  v.InferOutput<typeof quickTimerCreateSchema | typeof quickTimerRenameSchema>
>;
