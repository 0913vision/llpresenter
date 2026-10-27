import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {timerIdSchema} from './ids';
import {TIMER_NAME_LIMIT} from './quickTimerEdit';

export const timerRenameSchema = v.object({
  type: v.literal('timer.rename'),
  name: v.literal('timers'),
  timerId: timerIdSchema,
  timerName: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.maxLength(TIMER_NAME_LIMIT),
  ),
});

export type TimerRename = ReadonlyKnown<
  v.InferOutput<typeof timerRenameSchema>
>;
