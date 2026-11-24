import * as v from 'valibot';
import {quickItemIdSchema, timerIdSchema} from '../common/ids';
import type {ReadonlyKnown} from '../common/fileFormat';
import {NAME_LIMIT} from '../common/primitives';
import {MAX_TIMER_SECONDS} from './timers';

/**
 * An edit that adds a countdown 타이머 of `duration` seconds and the 빠른 실행 item
 * that starts it, both at once; the two ids must differ.
 */
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
    overrun: v.exactOptional(v.boolean()),
  }),
  v.check(
    edit => String(edit.quickItemId) !== edit.timerId,
    'Expected distinct IDs',
  ),
);

/** An edit that gives the 타이머 of a 빠른 실행 item a new name. */
export const quickTimerRenameSchema = v.object({
  type: v.literal('quick.timer.rename'),
  name: v.literal('quick'),
  quickItemId: quickItemIdSchema,
  timerName: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.maxLength(NAME_LIMIT),
  ),
});

/** An edit of a 타이머 through its 빠른 실행 item: creating one, or renaming it. */
export type QuickTimerEdit = ReadonlyKnown<
  v.InferOutput<typeof quickTimerCreateSchema | typeof quickTimerRenameSchema>
>;
