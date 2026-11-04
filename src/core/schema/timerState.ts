import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {timerIdSchema} from './ids';
import {epochMillisecondsSchema} from './overlayState';
import type {Result} from '../common/result';
import {parsePayload, plainObject, type PayloadError} from './payload';
import {nonNegativeNumber} from './primitives';
import {timerSchema} from './timers';

/** At most this many 타이머 carry a run in the live state. */
export const MAX_LIVE_TIMERS = 200;

const countedMs = v.pipe(
  nonNegativeNumber,
  v.maxValue(Number.MAX_SAFE_INTEGER),
);

const timerRunSchema = v.pipe(
  plainObject,
  v.variant('state', [
    v.object({
      state: v.literal('running'),
      since: epochMillisecondsSchema,
      countedMs,
      day: epochMillisecondsSchema,
      timer: v.exactOptional(timerSchema),
    }),
    v.object({
      state: v.literal('paused'),
      at: epochMillisecondsSchema,
      countedMs,
      day: epochMillisecondsSchema,
      wallAt: epochMillisecondsSchema,
      completed: v.exactOptional(v.literal(true)),
      timer: v.exactOptional(timerSchema),
    }),
  ]),
);

/** The runs of the started 타이머, by 타이머 id. A 타이머 without one is stopped. */
export const timerRunsSchema = v.pipe(
  plainObject,
  v.record(timerIdSchema, timerRunSchema),
  v.maxEntries(MAX_LIVE_TIMERS),
);

/**
 * One started 타이머: running since a time on main's monotonic 타이머 clock,
 * or paused at one, with the milliseconds it counted before that. `day` is
 * the local midnight, on the wall clock, of the day it started, and `wallAt`
 * the wall-clock moment of a pause, so a 타이머 that reads the time of day
 * keeps its day across midnight. `completed` holds a stop-at-zero countdown
 * at zero until reset or restarted, separately from an operator pause. `timer`
 * is the definition the run started with: an edit to the saved 타이머 reaches
 * it only after a reset or a finish, never mid-count (docs/spec/04-show.md).
 *
 * NOTE: the held `timer` keeps its name as it was when the run started, so a
 * rename shows in the 타이머 list at once but not in the run until the next
 * reset. Nothing reads the held name; it is there because the held definition
 * is the saved 타이머 as it was. Its size is bounded by the 타이머 name limit and
 * the 200 runs (checked in test/main/live/stateBudget.test.ts).
 */
export type TimerRun = ReadonlyKnown<v.InferOutput<typeof timerRunSchema>>;

export type TimerRuns = ReadonlyKnown<v.InferOutput<typeof timerRunsSchema>>;

/** Checks a reading of main's 타이머 clock. Never throws. */
export function parseTimerClockReading(
  value: unknown,
): Result<number, PayloadError> {
  return parsePayload(epochMillisecondsSchema, value);
}
