import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {timerIdSchema} from '../common/ids';

export const timerDeleteSchema = v.object({
  type: v.literal('timer.delete'),
  name: v.literal('timers'),
  timerId: timerIdSchema,
});

/** An edit that deletes a 타이머 by its id. */
export type TimerDelete = ReadonlyKnown<
  v.InferOutput<typeof timerDeleteSchema>
>;
