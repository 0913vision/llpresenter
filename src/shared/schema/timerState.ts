import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {timerIdSchema} from './ids';
import {epochMillisecondsSchema} from './overlayState';
import type {Result} from '../result';
import {parsePayload, plainObject, type PayloadError} from './payload';
import {nonNegativeNumber} from './primitives';

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
    }),
    v.object({
      state: v.literal('paused'),
      at: epochMillisecondsSchema,
      countedMs,
      day: epochMillisecondsSchema,
      wallAt: epochMillisecondsSchema,
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
 * keeps its day across midnight.
 */
export type TimerRun = ReadonlyKnown<v.InferOutput<typeof timerRunSchema>>;

export type TimerRuns = ReadonlyKnown<v.InferOutput<typeof timerRunsSchema>>;

/** Checks a reading of main's 타이머 clock. Never throws. */
export function parseTimerClockReading(
  value: unknown,
): Result<number, PayloadError> {
  return parsePayload(epochMillisecondsSchema, value);
}
