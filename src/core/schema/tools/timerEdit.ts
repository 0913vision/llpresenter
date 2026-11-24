import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {timerIdSchema} from '../common/ids';
import {NAME_LIMIT} from '../common/primitives';

export const timerRenameSchema = v.object({
  type: v.literal('timer.rename'),
  name: v.literal('timers'),
  timerId: timerIdSchema,
  timerName: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.maxLength(NAME_LIMIT),
  ),
});

/** An edit that gives a 타이머 a new name. */
export type TimerRename = ReadonlyKnown<
  v.InferOutput<typeof timerRenameSchema>
>;
