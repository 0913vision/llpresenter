import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {timerIdSchema} from './ids';

export const timerDeleteSchema = v.object({
  type: v.literal('timer.delete'),
  name: v.literal('timers'),
  timerId: timerIdSchema,
});

export type TimerDelete = ReadonlyKnown<
  v.InferOutput<typeof timerDeleteSchema>
>;
